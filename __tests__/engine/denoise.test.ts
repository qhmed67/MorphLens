import {
  adaptiveMedian,
  bilateralFilter,
  convolve,
  createImageBuffer,
  EngineCancelledError,
  gaussianFilter,
  gaussianKernel,
  getPixel,
  meanFilter,
  medianFilter,
  mse,
  noiseSaltPepper,
  setPixel,
  type ImageBuffer,
  type RunCtx,
} from '@/engine';
import {
  checkerboard,
  constant as constantFixture,
  ramp,
  verticalStep as stepFixture,
} from './fixtures';

/** 5×5 zero image with a single 255 impulse in the centre. */
function impulse(): ImageBuffer {
  const img = createImageBuffer(5, 5);
  setPixel(img, 2, 2, [255, 255, 255, 255]);
  return img;
}

type DenoiseFn = (src: ImageBuffer, params: Record<string, number>, ctx?: RunCtx) => ImageBuffer;

const ALL: { name: string; run: DenoiseFn }[] = [
  { name: 'meanFilter', run: (s, p, c) => meanFilter(s, p, c) },
  { name: 'gaussianFilter', run: (s, p, c) => gaussianFilter(s, p, c) },
  { name: 'medianFilter', run: (s, p, c) => medianFilter(s, p, c) },
  { name: 'adaptiveMedian', run: (s, p, c) => adaptiveMedian(s, p, c) },
  { name: 'bilateralFilter', run: (s, p, c) => bilateralFilter(s, p, c) },
];

describe('meanFilter', () => {
  it('keeps a constant image constant', () => {
    const out = meanFilter(constantFixture(8, 96), { k: 5 });
    expect(Array.from(out.data)).toEqual(Array.from(constantFixture(8, 96).data));
  });

  it('spreads an impulse over the window (255/9 ≈ 28 at the centre)', () => {
    const out = meanFilter(impulse(), { k: 3 });
    expect(getPixel(out, 2, 2)[0]).toBe(28); // 255/9 = 28.33 → 28
    expect(getPixel(out, 0, 0)[0]).toBe(0); // corner window does not reach the impulse
  });

  it('honours the border policy at the corner', () => {
    const src = impulse();
    setPixel(src, 0, 0, [255, 255, 255, 255]);
    // zero border: outside taps are black but still divide by k² → 255/9 = 28.
    expect(getPixel(meanFilter(src, { k: 3 }, undefined, 'zero'), 0, 0)[0]).toBe(28);
    // clamp border replicates the corner into 4 of 9 taps → 255·4/9 = 113.
    expect(getPixel(meanFilter(src, { k: 3 }, undefined, 'clamp'), 0, 0)[0]).toBe(113);
  });
});

describe('gaussianFilter', () => {
  it('keeps a constant image constant', () => {
    const out = gaussianFilter(constantFixture(8, 200), { sigma: 1.4 });
    expect(Array.from(out.data)).toEqual(Array.from(constantFixture(8, 200).data));
  });

  it('matches the separable 2-D gaussian convolution within ±1', () => {
    const src = ramp(16, 16);
    const separable = gaussianFilter(src, { sigma: 1.4 });
    const twoD = convolve(src, gaussianKernel(1.4));
    for (let i = 0; i < separable.data.length; i += 1) {
      // Alpha is copied by both paths.
      expect(Math.abs(separable.data[i] - twoD.data[i])).toBeLessThanOrEqual(1);
    }
  });

  it('clamps sigma into the supported range instead of throwing', () => {
    const src = constantFixture(8, 128);
    expect(Array.from(gaussianFilter(src, { sigma: 999 }).data)).toEqual(Array.from(src.data));
    expect(Array.from(gaussianFilter(src, { sigma: 0 }).data)).toEqual(Array.from(src.data));
  });
});

describe('medianFilter', () => {
  it('removes an isolated salt impulse', () => {
    const src = constantFixture(8, 128);
    setPixel(src, 4, 4, [255, 255, 255, 255]);
    const out = medianFilter(src, { k: 3 });
    expect(Array.from(out.data)).toEqual(Array.from(constantFixture(8, 128).data));
  });

  it('keeps a checkerboard identical with reflect border (5-of-9 majority)', () => {
    const src = checkerboard(8, 8);
    const out = medianFilter(src, { k: 3 }, undefined, 'reflect');
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('flips a border pixel under clamp where the mirrored row breaks parity', () => {
    const src = checkerboard(8, 8);
    const out = medianFilter(src, { k: 3 }); // default clamp
    expect(getPixel(src, 1, 0)[0]).toBe(255); // input parity-odd pixel
    expect(getPixel(out, 1, 0)[0]).toBe(0); // duplicated row makes 5 zeros out of 9
    expect(getPixel(out, 3, 3)[0]).toBe(getPixel(src, 3, 3)[0]); // interior untouched
  });
});

describe('adaptiveMedian', () => {
  it('leaves a constant image unchanged', () => {
    const src = constantFixture(8, 128);
    expect(Array.from(adaptiveMedian(src, { kMax: 7 }).data)).toEqual(Array.from(src.data));
  });

  it('recovers more from heavy salt noise than a plain 3×3 median', () => {
    const src = constantFixture(64, 128);
    const noisy = noiseSaltPepper(src, { probability: 0.3, seed: 2 });
    const adaptive = adaptiveMedian(noisy, { kMax: 7 });
    const plain = medianFilter(noisy, { k: 3 });
    expect(mse(adaptive, src)).toBeLessThan(mse(plain, src));
  });
});

describe('bilateralFilter', () => {
  it('keeps a constant image constant', () => {
    const src = constantFixture(16, 77);
    const out = bilateralFilter(src, { sigmaSpatial: 2, sigmaRange: 30 });
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('preserves a step edge that a mean filter smears', () => {
    const src = stepFixture(64, 64, 0, 255);
    const smooth = bilateralFilter(src, { sigmaSpatial: 2, sigmaRange: 30 });
    const blurred = meanFilter(src, { k: 5 });
    // One pixel left of the edge: bilateral blocks cross-edge taps by the range term.
    expect(getPixel(smooth, 31, 32)[0]).toBeLessThanOrEqual(5);
    expect(getPixel(smooth, 32, 32)[0]).toBeGreaterThanOrEqual(250);
    // The mean filter has no range term, so the edge bleeds into the dark side.
    expect(getPixel(blurred, 31, 32)[0]).toBeGreaterThanOrEqual(90);
  });
});

describe('denoise execution policy', () => {
  it('throws EngineCancelledError when cancelled', () => {
    const src = ramp(16, 16);
    const ctx: RunCtx = { shouldCancel: () => true };
    for (const { run } of ALL) {
      expect(() => run(src, {}, ctx)).toThrow(EngineCancelledError);
    }
  });

  it('reports progress and finishes at 1', () => {
    const seen: number[] = [];
    medianFilter(ramp(32, 32), { k: 3 }, { onProgress: (value) => seen.push(value) });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('never mutates the input buffer', () => {
    for (const { run } of ALL) {
      const src = ramp(12, 12);
      const before = Array.from(src.data);
      run(src, {});
      expect(Array.from(src.data)).toEqual(before);
    }
  });
});
