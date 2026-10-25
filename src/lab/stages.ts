/**
 * stages.ts — turn a registered operation into a sequence of *visual* stages
 * computed from the user's own photo (owner directive: explain the maths on
 * this image, never on a separate example).
 *
 * Every builder derives its intermediate images from engine functions, so a
 * stage can never drift from what the operation actually does: the final
 * stage is the real result, and the in-between stages are the actual low-pass,
 * detail or gradient maps the algorithm works with. Notes carry the live
 * parameter values (σ, k, amounts) so the text is specific to this run.
 *
 * Pure module: no React/Skia. The screen converts each `ImageBuffer` to an
 * SkImage for display (bridge precedent).
 */
import {
  cannyStages,
  gaussianFilter,
  getOperation,
  mergeParams,
  runOperation,
  type ImageBuffer,
} from '@/engine';

/** One still in the explanation; the screen crossfades between them. */
export type Stage = {
  key: string;
  title: string;
  /** One-sentence explanation for this step, with live values. */
  note: string;
  image: ImageBuffer;
};

export type StageSet = {
  opId: string;
  /** Human operation name from the registry. */
  title: string;
  /** The registry formula, shown on the formula card. */
  formula: string;
  stages: Stage[];
  /**
   * Representative pixel for the maths panel: the pixel that changed the most
   * between the first and last stage, so the numbers describe real detail, not
   * a flat area.
   */
  probe: { x: number; y: number };
  /** Grey level of the probe pixel in each stage (same order as `stages`). */
  values: number[];
};

/** One adjustable parameter exposed by the Trace screen. */
export type TraceControl = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

/**
 * Primary control per operation (owner: "the value of sharpening I can add …
 * what happens if we change it"). Range/step mirror the registry definitions;
 * ops not listed here are explained with their route/default params.
 */
export const TRACE_CONTROLS: Record<string, TraceControl> = {
  unsharpMask: { key: 'amount', label: 'Sharpening', min: 0, max: 3, step: 0.05 },
  gaussianFilter: { key: 'sigma', label: 'Sigma', min: 0.5, max: 5, step: 0.1 },
  meanFilter: { key: 'k', label: 'Window', min: 3, max: 9, step: 2 },
  medianFilter: { key: 'k', label: 'Window', min: 3, max: 7, step: 2 },
  adaptiveMedian: { key: 'kMax', label: 'Max window', min: 3, max: 11, step: 2 },
  bilateralFilter: { key: 'sigmaRange', label: 'Range σ', min: 10, max: 100, step: 5 },
  noiseGaussian: { key: 'sigma', label: 'Strength', min: 0, max: 50, step: 0.5 },
  noiseSaltPepper: { key: 'probability', label: 'Impulse rate', min: 0, max: 0.2, step: 0.005 },
  noiseSpeckle: { key: 'sigma', label: 'Strength', min: 0, max: 1, step: 0.01 },
  canny: { key: 'sigma', label: 'Blur σ', min: 0.5, max: 3, step: 0.1 },
  clahe: { key: 'clip', label: 'Clip limit', min: 1, max: 8, step: 0.5 },
};

/** Compact number for notes: 1.40 → 1.4, 3 → 3. */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Snap a normalised slider position (0..1) onto a control's registry step and
 * clamp it to the declared range. Shared by Trace and its tests so the slider
 * and the engine always agree on the number in between.
 *
 * @param control - the operation's primary control descriptor.
 * @param normalised - slider position, 0..1 (values outside are clamped).
 * @returns the parameter value rounded to the control's step.
 */
export function traceControlValue(control: TraceControl, normalised: number): number {
  const raw = control.min + normalised * (control.max - control.min);
  // Steps are anchored at the control's minimum (window sizes 3, 5, 7 …), not
  // at zero — rounding raw/step would hand the engine an even median window.
  const steps = Math.round((raw - control.min) / control.step);
  const snapped = control.min + steps * control.step;
  const clamped = Math.min(control.max, Math.max(control.min, snapped));
  return Number(clamped.toFixed(3));
}

/**
 * Signed difference map `a − b`, rendered around mid-grey: positive detail
 * (where a is brighter) reads light, negative reads dark. Gain amplifies the
 * residual so ordinary detail becomes visible without clipping most pixels.
 */
function differenceMap(a: ImageBuffer, b: ImageBuffer, gain = 4): ImageBuffer {
  const data = new Uint8ClampedArray(a.data.length);
  for (let i = 0; i < a.data.length; i += 4) {
    data[i] = 128 + (a.data[i] - b.data[i]) * gain;
    data[i + 1] = 128 + (a.data[i + 1] - b.data[i + 1]) * gain;
    data[i + 2] = 128 + (a.data[i + 2] - b.data[i + 2]) * gain;
    data[i + 3] = 255;
  }
  return { width: a.width, height: a.height, data };
}

/** Wrap the requested registry operation's identity into a StageSet shell. */
function shell(opId: string, stages: Stage[]): StageSet {
  const operation = getOperation(opId);
  const { probe, values } = probeStages(stages);
  return { opId, title: operation.name, formula: operation.explain.formula, stages, probe, values };
}

/** Rec.709 luma of one RGBA pixel. */
function lumaAt(data: Uint8ClampedArray, index: number): number {
  return 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
}

/**
 * Pick the pixel with the largest first→last luma change and read every
 * stage's value there. This keeps the maths panel honest to the operation:
 * a blur's probe sits on texture, an edge detector's on an edge.
 *
 * @complexity O(W·H·S) sampling only — stages are already computed.
 */
function probeStages(stages: Stage[]): { probe: { x: number; y: number }; values: number[] } {
  const { width, height } = stages[0].image;
  const first = stages[0].image.data;
  const last = stages[stages.length - 1].image.data;
  let best = -1;
  let px = Math.floor(width / 2);
  let py = Math.floor(height / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const delta = Math.abs(lumaAt(last, index) - lumaAt(first, index));
      if (delta > best) {
        best = delta;
        px = x;
        py = y;
      }
    }
  }
  const sample = (py * width + px) * 4;
  const values = stages.map((stage) => Math.round(lumaAt(stage.image.data, sample) * 10) / 10);
  return { probe: { x: px, y: py }, values };
}

const original = (source: ImageBuffer): Stage => ({
  key: 'original',
  title: 'Original',
  note: 'Your photo as imported. Every stage after this is computed from these exact pixels.',
  image: source,
});

/**
 * Build the visual stages for a supported operation.
 *
 * @param opId - registry operation id (e.g. 'unsharpMask', 'canny').
 * @param source - proxy pixels of the user's photo (≤512 px per side).
 * @param overrides - caller params; merged with registry defaults first.
 * @returns null when the operation has no staged explanation yet.
 * @complexity O(N·k) per stage — at most five stages on a ≤512² proxy.
 */
export function buildStages(
  opId: string,
  source: ImageBuffer,
  overrides: Record<string, number> = {},
): StageSet | null {
  const operation = getOperation(opId);
  const params = mergeParams(operation.params, overrides);

  switch (opId) {
    // --- Sharpening: show the low-pass, the detail it hides, then the result.
    case 'unsharpMask': {
      const sigma = params.radius;
      const amount = params.amount;
      const blur = gaussianFilter(source, { sigma });
      const detail = differenceMap(source, blur, 4);
      const result = operation.run(source, params);
      return shell(opId, [
        original(source),
        {
          key: 'lowpass',
          title: 'Low-pass',
          note: `A gaussian blur (σ = ${fmt(sigma)}) keeps only coarse structure — the detail is averaged away.`,
          image: blur,
        },
        {
          key: 'detail',
          title: 'Detail layer',
          note: 'in − blur isolates edges and texture. This is the image sharpening amplifies.',
          image: detail,
        },
        {
          key: 'sharpened',
          title: 'Sharpened',
          note: `in + ${fmt(amount)} × detail. Edges gain contrast; flat areas stay quiet.`,
          image: result,
        },
      ]);
    }

    // --- Denoising: noise, then what the filter does about it.
    case 'medianFilter':
    case 'adaptiveMedian': {
      const k = opId === 'medianFilter' ? params.k : params.kMax;
      const windowLabel = opId === 'medianFilter' ? `k=${k}` : `max k=${k}`;
      const noisy = runOperation('noiseSaltPepper', source, { probability: 0.05, seed: 7 });
      const cleaned = operation.run(noisy, params);
      return shell(opId, [
        original(source),
        {
          key: 'noisy',
          title: 'Impulse noise',
          note: 'Salt-and-pepper: random pixels forced to black or white — the failure median is designed for.',
          image: noisy,
        },
        {
          key: 'cleaned',
          title: `Median ${windowLabel}`,
          note: 'The median ignores outliers: each pixel becomes the middle value of its neighbourhood.',
          image: cleaned,
        },
      ]);
    }
    case 'meanFilter':
    case 'gaussianFilter':
    case 'bilateralFilter': {
      const result = operation.run(source, params);
      const removed = differenceMap(source, result, 4);
      const detail =
        opId === 'gaussianFilter'
          ? `σ = ${fmt(params.sigma)}`
          : opId === 'meanFilter'
            ? `k = ${params.k}`
            : `σs = ${fmt(params.sigmaSpatial)}, σr = ${fmt(params.sigmaRange)}`;
      return shell(opId, [
        original(source),
        {
          key: 'filtered',
          title: 'Smoothed',
          note: `Every pixel is replaced by a weighted neighbourhood average (${detail}).`,
          image: result,
        },
        {
          key: 'removed',
          title: 'What was removed',
          note: 'The residual: noise and fine texture the filter suppressed. Strong edges survive as thin outlines.',
          image: removed,
        },
      ]);
    }

    // --- Noise models: show the field that gets added, then the result.
    case 'noiseGaussian':
    case 'noiseSaltPepper':
    case 'noiseSpeckle': {
      const noisy = operation.run(source, params);
      const residual = differenceMap(noisy, source, 4);
      const label =
        opId === 'noiseGaussian'
          ? `Gaussian, σ = ${fmt(params.sigma)}`
          : opId === 'noiseSaltPepper'
            ? `Impulses, p = ${fmt(params.probability)}`
            : `Speckle, σ = ${fmt(params.sigma)}`;
      return shell(opId, [
        original(source),
        {
          key: 'field',
          title: 'Noise field',
          note: `${label}, drawn from a seeded generator — the same seed always produces the same field.`,
          image: residual,
        },
        {
          key: 'noisy',
          title: 'Noisy image',
          note: 'The field added to your pixels. Try a denoise filter on this to see the other half of the story.',
          image: noisy,
        },
      ]);
    }

    // --- Edges: luma, gradient magnitude, one-pixel edges.
    case 'sobelEdges': {
      const luma = runOperation('grayscale', source);
      const edges = operation.run(source, params);
      return shell(opId, [
        original(source),
        {
          key: 'luma',
          title: 'Luma',
          note: 'Gradients are computed on brightness — Rec.709 luma collapses colour to the signal edges care about.',
          image: luma,
        },
        {
          key: 'magnitude',
          title: 'Gradient magnitude',
          note: 'Sobel: |Gx| and |Gy| measure how fast brightness changes. Strong steps light up.',
          image: edges,
        },
      ]);
    }
    case 'canny': {
      const stages = cannyStages(source, params);
      return shell(opId, [
        original(source),
        {
          key: 'blur',
          title: 'Smoothed',
          note: `Gaussian σ = ${fmt(params.sigma)} removes noise before differentiating — differentiation amplifies it otherwise.`,
          image: stages.blur,
        },
        {
          key: 'magnitude',
          title: 'Gradient magnitude',
          note: 'Gradient strength per pixel, normalised to 0..255.',
          image: stages.magnitude,
        },
        {
          key: 'nonmax',
          title: 'Thinned ridges',
          note: 'Non-maximum suppression keeps only the ridge of each edge — one pixel wide.',
          image: stages.nonMax,
        },
        {
          key: 'edges',
          title: 'Edges',
          note: `Double threshold + hysteresis (low ${fmt(params.low)}, high ${fmt(params.high)}): weak pixels survive only if connected to strong ones.`,
          image: stages.edges,
        },
      ]);
    }

    // --- Global tone: two stages, formula carries the maths.
    case 'equalize':
    case 'contrastStretch':
    case 'clahe':
    case 'radialMask':
    case 'grayscale':
    case 'invert':
    case 'sepia':
    case 'posterize':
    case 'brightness':
    case 'contrast':
    case 'gamma':
    case 'saturation': {
      const result = operation.run(source, params);
      return shell(opId, [
        original(source),
        {
          key: 'result',
          title: 'Result',
          note: operation.explain.summary,
          image: result,
        },
      ]);
    }

    default:
      return null;
  }
}
