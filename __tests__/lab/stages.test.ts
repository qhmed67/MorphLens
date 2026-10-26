/**
 * Trace stage builders — the explanation must never drift from the engine.
 *
 * The core invariants these tests lock down:
 * 1. The final stage is pixel-identical to the registered operation's real run.
 * 2. Intermediate stages are the actual engine intermediates (same arrays the
 *    algorithm works with), not re-implemented approximations.
 * 3. Notes carry the merged parameter values actually used.
 * 4. Every stage keeps the source dimensions and is fully opaque.
 */
import {
  cannyStages,
  getOperation,
  gaussianFilter,
  runOperation,
  type ImageBuffer,
} from '@/engine';
import { TRACE_CONTROLS, buildStages, traceControlValue } from '@/lab/stages';
import { CODE_EXCERPTS, codeExcerpt } from '@/lab/codeExcerpts';
import { ramp, verticalStep } from '../engine/fixtures';

function expectOpaque(img: ImageBuffer, width: number, height: number): void {
  expect(img.width).toBe(width);
  expect(img.height).toBe(height);
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] !== 255) throw new Error(`alpha at ${i} is ${img.data[i]}`);
  }
}

describe('buildStages', () => {
  // A step edge plus a ramp gives sharpening/edges/noise something real to act on.
  const source = verticalStep(32, 32, 24, 232);
  const scenic = ramp(32, 32);

  it('returns null for operations without a staged explanation', () => {
    expect(buildStages('convolve', source)).toBeNull();
    expect(buildStages('idealLowPass', source)).toBeNull();
    expect(buildStages('spectrum', source)).toBeNull();
  });

  it('stages unsharp mask as original → low-pass → detail → sharpened', () => {
    const set = buildStages('unsharpMask', source, { amount: 1.2, radius: 1.4 });
    expect(set).not.toBeNull();
    expect(set!.opId).toBe('unsharpMask');
    expect(set!.title).toBe(getOperation('unsharpMask').name);
    expect(set!.formula).toBe(getOperation('unsharpMask').explain.formula);
    expect(set!.stages.map((stage) => stage.key)).toEqual([
      'original',
      'lowpass',
      'detail',
      'sharpened',
    ]);

    // Stage 1 is the untouched source (same reference — no copy needed).
    expect(set!.stages[0].image).toBe(source);

    // Stage 2 is exactly the engine's gaussian low-pass with the stated radius.
    const blur = gaussianFilter(source, { sigma: 1.4 });
    expect(set!.stages[1].image.data).toEqual(blur.data);

    // Stage 3 is a signed difference centred on mid-grey: flat areas ≈ 128.
    const detail = set!.stages[2].image;
    expect(detail.data[0]).toBe(128);
    // The step edge produces positive/negative detail, so not all 128.
    expect(Array.from(detail.data).some((v, i) => i % 4 !== 3 && v !== 128)).toBe(true);

    // Stage 4 must be the real operation result, byte for byte.
    const merged = { amount: 1.2, radius: 1.4 };
    expect(set!.stages[3].image.data).toEqual(runOperation('unsharpMask', source, merged).data);

    // Notes state the live numbers.
    expect(set!.stages[1].note).toContain('1.4');
    expect(set!.stages[3].note).toContain('1.2');
    set!.stages.forEach((stage) => expectOpaque(stage.image, 32, 32));
  });

  it('uses registry defaults when no overrides are given', () => {
    const set = buildStages('unsharpMask', source);
    expect(set!.stages[1].note).toContain('1.4'); // default radius
  });

  it('stages median denoise as noisy → cleaned and is deterministic', () => {
    const first = buildStages('medianFilter', source, { k: 3 });
    const second = buildStages('medianFilter', source, { k: 3 });
    expect(first!.stages.map((stage) => stage.key)).toEqual(['original', 'noisy', 'cleaned']);
    // Fixed seed 7: the noise field (and therefore everything after it) repeats.
    expect(first!.stages[1].image.data).toEqual(second!.stages[1].image.data);
    expect(first!.stages[2].image.data).toEqual(second!.stages[2].image.data);
    expect(first!.stages[2].title).toBe('Median k=3');
    expect(first!.stages[1].note).toContain('Salt-and-pepper');
    first!.stages.forEach((stage) => expectOpaque(stage.image, 32, 32));
  });

  it('labels the adaptive median by its max window', () => {
    const set = buildStages('adaptiveMedian', source, { kMax: 9 });
    expect(set!.stages[2].title).toBe('Median max k=9');
    expectOpaque(set!.stages[2].image, 32, 32);
  });

  it.each([
    ['gaussianFilter', { sigma: 1.8 }, 'σ = 1.8'],
    ['meanFilter', { k: 5 }, 'k = 5'],
    ['bilateralFilter', { sigmaSpatial: 2, sigmaRange: 40 }, 'σs = 2, σr = 40'],
  ])('stages %s as filtered → removed detail', (opId, overrides, detailNote) => {
    const set = buildStages(opId, scenic, overrides);
    expect(set!.stages.map((stage) => stage.key)).toEqual(['original', 'filtered', 'removed']);
    expect(set!.stages[1].note).toContain(detailNote);

    // The removed-detail map is the source minus the real filter output.
    const result = runOperation(opId, scenic, overrides);
    expect(set!.stages[1].image.data).toEqual(result.data);
    for (let i = 0; i < set!.stages[2].image.data.length; i += 4) {
      const expected = 128 + (scenic.data[i] - result.data[i]) * 4;
      expect(set!.stages[2].image.data[i]).toBe(Math.max(0, Math.min(255, expected)));
    }
  });

  it.each(['noiseGaussian', 'noiseSaltPepper', 'noiseSpeckle'])(
    'stages %s as field → noisy image',
    (opId) => {
      const overrides: Record<string, number> =
        opId === 'noiseSaltPepper' ? { probability: 0.1, seed: 3 } : { sigma: 20, seed: 3 };
      const set = buildStages(opId, scenic, overrides);
      expect(set!.stages.map((stage) => stage.key)).toEqual(['original', 'field', 'noisy']);
      expect(set!.stages[2].image.data).toEqual(runOperation(opId, scenic, overrides).data);
      // The field is the signed residual around mid-grey.
      const field = set!.stages[1].image;
      expect(Array.from(field.data).some((v, i) => i % 4 !== 3 && v !== 128)).toBe(true);
      set!.stages.forEach((stage) => expectOpaque(stage.image, 32, 32));
    },
  );

  it('stages sobel as original → luma → magnitude', () => {
    const set = buildStages('sobelEdges', source, { threshold: 0 });
    expect(set!.stages.map((stage) => stage.key)).toEqual(['original', 'luma', 'magnitude']);
    expect(set!.stages[1].image.data).toEqual(runOperation('grayscale', source).data);
    expect(set!.stages[2].image.data).toEqual(
      runOperation('sobelEdges', source, { threshold: 0 }).data,
    );
  });

  it('stages canny with every pipeline intermediate from cannyStages', () => {
    const overrides = { sigma: 1.4, low: 0.1, high: 0.3 };
    const set = buildStages('canny', source, overrides);
    expect(set!.stages.map((stage) => stage.key)).toEqual([
      'original',
      'blur',
      'magnitude',
      'nonmax',
      'edges',
    ]);
    const pipeline = cannyStages(source, overrides);
    expect(set!.stages[1].image.data).toEqual(pipeline.blur.data);
    expect(set!.stages[2].image.data).toEqual(pipeline.magnitude.data);
    expect(set!.stages[3].image.data).toEqual(pipeline.nonMax.data);
    expect(set!.stages[4].image.data).toEqual(pipeline.edges.data);
    // nonMax is intentionally sparse (transparent outside ridges) so it reads
    // as glowing lines; every other stage is fully opaque.
    const nonMax = set!.stages[3].image;
    expect(Array.from(nonMax.data).every((v, i) => i % 4 !== 3 || v === 0 || v === 255)).toBe(true);
    [set!.stages[0], set!.stages[1], set!.stages[2], set!.stages[4]].forEach((stage) =>
      expectOpaque(stage.image, 32, 32),
    );
  });

  it.each([
    'equalize',
    'contrastStretch',
    'clahe',
    'grayscale',
    'invert',
    'sepia',
    'posterize',
    'brightness',
    'contrast',
    'gamma',
    'saturation',
  ])('stages %s as original → result', (opId) => {
    const set = buildStages(opId, scenic);
    expect(set!.stages.map((stage) => stage.key)).toEqual(['original', 'result']);
    expect(set!.stages[1].image.data).toEqual(runOperation(opId, scenic).data);
    expect(set!.stages[1].note).toBe(getOperation(opId).explain.summary);
    set!.stages.forEach((stage) => expectOpaque(stage.image, 32, 32));
  });
});

/**
 * The Trace maths panel reads a probe pixel and the adjustable controls from
 * the same StageSet the photo uses. These tests keep the probe honest, keep
 * every control aligned with the registry, and guarantee that each traceable
 * operation has a code excerpt for the "Code" tab.
 */
describe('Trace maths data', () => {
  const traceable = [
    'unsharpMask',
    'medianFilter',
    'adaptiveMedian',
    'meanFilter',
    'gaussianFilter',
    'bilateralFilter',
    'noiseGaussian',
    'noiseSaltPepper',
    'noiseSpeckle',
    'sobelEdges',
    'canny',
    'equalize',
    'contrastStretch',
    'clahe',
    'grayscale',
    'invert',
    'sepia',
    'posterize',
    'brightness',
    'contrast',
    'gamma',
    'saturation',
  ] as const;

  const source = verticalStep(32, 32, 24, 232);

  const lumaAt = (data: Uint8ClampedArray, index: number): number =>
    0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];

  it.each(traceable)('reports one grey level per stage and an in-bounds probe for %s', (opId) => {
    const set = buildStages(opId, source);
    expect(set).not.toBeNull();
    expect(set!.probe.x).toBeGreaterThanOrEqual(0);
    expect(set!.probe.x).toBeLessThan(32);
    expect(set!.probe.y).toBeGreaterThanOrEqual(0);
    expect(set!.probe.y).toBeLessThan(32);
    expect(set!.values).toHaveLength(set!.stages.length);

    const sample = (set!.probe.y * 32 + set!.probe.x) * 4;
    set!.stages.forEach((stage, index) => {
      expect(set!.values[index]).toBeCloseTo(lumaAt(stage.image.data, sample), 1);
    });
  });

  it('probes the pixel with the largest first-to-last change', () => {
    const set = buildStages('unsharpMask', source, { amount: 1.2, radius: 1.4 })!;
    const first = set.stages[0].image.data;
    const last = set.stages[set.stages.length - 1].image.data;
    const deltaAt = (index: number): number => Math.abs(lumaAt(last, index) - lumaAt(first, index));

    const probeDelta = deltaAt((set.probe.y * 32 + set.probe.x) * 4);
    let maxDelta = 0;
    for (let i = 0; i < first.length; i += 4) {
      maxDelta = Math.max(maxDelta, deltaAt(i));
    }
    expect(probeDelta).toBeCloseTo(maxDelta, 5);
    // The step edge actually changes, so the maths panel has something to say.
    expect(probeDelta).toBeGreaterThan(0);
    expect(set.values[set.values.length - 1]).not.toBe(set.values[0]);
  });

  it('keeps every adjustable control aligned with its registry definition', () => {
    for (const [opId, control] of Object.entries(TRACE_CONTROLS)) {
      const operation = getOperation(opId);
      const param = operation.params.find((entry) => entry.key === control.key);
      expect(param).toBeDefined();
      expect(param!.min).toBe(control.min);
      expect(param!.max).toBe(control.max);
      expect(param!.step).toBe(control.step);
      expect(param!.default).toBeGreaterThanOrEqual(control.min);
      expect(param!.default).toBeLessThanOrEqual(control.max);

      // Any snapped value must land on the registry grid starting at `min`.
      const value = traceControlValue(control, 0.5);
      const steps = (value - control.min) / control.step;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    }
  });

  it('steps control values from the minimum and clamps the ends', () => {
    const amount = TRACE_CONTROLS.unsharpMask;
    expect(traceControlValue(amount, 0)).toBe(0);
    expect(traceControlValue(amount, 1)).toBe(3);
    expect(traceControlValue(amount, -1)).toBe(0);
    expect(traceControlValue(amount, 2)).toBe(3);
    expect(traceControlValue(amount, 0.5)).toBeCloseTo(1.5, 6);

    const median = TRACE_CONTROLS.medianFilter;
    expect(traceControlValue(median, 0)).toBe(3);
    expect(traceControlValue(median, 0.2)).toBe(3);
    expect(traceControlValue(median, 0.25)).toBe(5);
    expect(traceControlValue(median, 0.5)).toBe(5);
    expect(traceControlValue(median, 0.75)).toBe(7);
    expect(traceControlValue(median, 1)).toBe(7);
  });

  it('has a code excerpt for every traceable operation and no stale extras', () => {
    for (const opId of traceable) {
      const code = codeExcerpt(opId);
      expect(code).toBeTruthy();
      expect(code!.length).toBeGreaterThan(40);
      // The Code tab teaches Python, so every excerpt is a Python snippet.
      expect(code).toContain('#');
      expect(code).not.toContain('const ');
    }
    expect(Object.keys(CODE_EXCERPTS).sort()).toEqual([...traceable].sort());
  });
});
