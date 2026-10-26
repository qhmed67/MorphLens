import {
  bandPass,
  bandReject,
  butterworthHighPass,
  butterworthLowPass,
  createRng,
  EngineCancelledError,
  fft1d,
  fft2d,
  fftShift,
  gaussianHighPass,
  gaussianLowPass,
  getPixel,
  idealHighPass,
  idealLowPass,
  nextPow2,
  spectrumImage,
  zeroPadPow2,
  type ImageBuffer,
} from '@/engine';
import { constant as constantFixture, verticalStep as stepFixture } from './fixtures';

/** Random complex signal of length n from the shared seeded PRNG. */
function randomSignal(n: number, seed: number): { re: Float64Array; im: Float64Array } {
  const rng = createRng(seed);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    re[i] = rng() * 200 - 100;
    im[i] = rng() * 200 - 100;
  }
  return { re, im };
}

describe('nextPow2', () => {
  it('returns the smallest power of two ≥ n, at least 2', () => {
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(1)).toBe(2);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(64)).toBe(64);
  });
});

describe('fft1d', () => {
  it('rejects non-power-of-two lengths', () => {
    expect(() => fft1d(new Float64Array(3), new Float64Array(3))).toThrow(/power of two/);
    expect(() => fft1d(new Float64Array(4), new Float64Array(3))).toThrow(/mismatch/);
  });

  it('puts n·c in bin 0 for a constant signal', () => {
    const re = new Float64Array(8).fill(3);
    const im = new Float64Array(8);
    fft1d(re, im);
    expect(re[0]).toBeCloseTo(24, 9);
    for (let k = 1; k < 8; k += 1) {
      expect(Math.abs(re[k])).toBeLessThan(1e-9);
      expect(Math.abs(im[k])).toBeLessThan(1e-9);
    }
  });

  it('splits a cosine into bins k and n−k at n/2', () => {
    const n = 8;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i += 1) re[i] = Math.cos((2 * Math.PI * i) / n);
    fft1d(re, im);
    expect(re[1]).toBeCloseTo(n / 2, 9);
    expect(re[n - 1]).toBeCloseTo(n / 2, 9);
    expect(re[0]).toBeCloseTo(0, 9);
  });

  it('round-trips a random signal within 1e-9', () => {
    const { re, im } = randomSignal(16, 42);
    const origRe = Float64Array.from(re);
    const origIm = Float64Array.from(im);
    fft1d(re, im);
    fft1d(re, im, true);
    for (let i = 0; i < 16; i += 1) {
      expect(Math.abs(re[i] - origRe[i])).toBeLessThan(1e-9);
      expect(Math.abs(im[i] - origIm[i])).toBeLessThan(1e-9);
    }
  });
});

describe('fft2d', () => {
  it('round-trips an 8×8 plane within 1e-9 (fft-round-trip)', () => {
    const { re, im } = randomSignal(64, 7);
    const origRe = Float64Array.from(re);
    const origIm = Float64Array.from(im);
    fft2d(8, 8, re, im);
    fft2d(8, 8, re, im, true);
    for (let i = 0; i < 64; i += 1) {
      expect(Math.abs(re[i] - origRe[i])).toBeLessThan(1e-9);
      expect(Math.abs(im[i] - origIm[i])).toBeLessThan(1e-9);
    }
  });

  it('validates plane size', () => {
    expect(() => fft2d(8, 8, new Float64Array(16), new Float64Array(16))).toThrow(/plane size/);
  });
});

describe('fftShift', () => {
  it('moves DC from (0,0) to the centre and is an involution', () => {
    const re = new Float64Array(64);
    const im = new Float64Array(64);
    re[0] = 1;
    fftShift(8, 8, re, im);
    expect(re[4 * 8 + 4]).toBe(1);
    expect(re[0]).toBe(0);
    fftShift(8, 8, re, im);
    expect(re[0]).toBe(1);
    expect(re[4 * 8 + 4]).toBe(0);
  });
});

describe('zeroPadPow2', () => {
  it('keeps an already power-of-two plane as-is (fft-8×8 ⇒ 8×8)', () => {
    const plane = new Float64Array(64).fill(5);
    const padded = zeroPadPow2(8, 8, plane);
    expect(padded.width).toBe(8);
    expect(padded.height).toBe(8);
    expect(padded.data).toBe(plane); // no copy needed
  });

  it('embeds a 5×3 plane in the top-left of an 8×4 canvas', () => {
    const plane = new Float64Array(15);
    plane[0] = 11; // (0,0)
    plane[4] = 12; // (4,0): right edge of the source row
    const padded = zeroPadPow2(5, 3, plane);
    expect(padded.width).toBe(8);
    expect(padded.height).toBe(4);
    expect(padded.data[0]).toBe(11);
    expect(padded.data[4]).toBe(12);
    expect(padded.data[5]).toBe(0); // padding column
    expect(padded.data[8 * 3]).toBe(0); // padding row
  });
});

/** Mean of the red channel over the in-image region. */
function meanRed(img: ImageBuffer): number {
  let sum = 0;
  const n = img.data.length / 4;
  for (let p = 0; p < img.data.length; p += 4) sum += img.data[p];
  return sum / n;
}

describe('frequency filters', () => {
  it('gaussian low-pass preserves the mean and smears the edge', () => {
    const src = stepFixture(64, 64, 0, 255);
    const out = gaussianLowPass(src, { cutoff: 0.1 });
    expect(Math.abs(meanRed(out) - meanRed(src))).toBeLessThanOrEqual(2);
    // σ_D = 0.1 cycles/px ⇒ spatial σ ≈ 1/(2π·0.1) ≈ 1.6 px: the edge is
    // smeared locally (dark side lifted, bright side lowered), not globally.
    expect(getPixel(out, 31, 32)[0]).toBeGreaterThan(0);
    expect(getPixel(out, 32, 32)[0]).toBeLessThan(255);
    expect(getPixel(out, 20, 32)[0]).toBe(0); // beyond a few σ the step is flat again
  });

  it('high-pass of a constant image is black (DC removed)', () => {
    const src = constantFixture(16, 128);
    for (const hp of [idealHighPass, gaussianHighPass, butterworthHighPass]) {
      const out = hp(src, { cutoff: 0.2, order: 2 });
      for (let p = 0; p < out.data.length; p += 4) expect(out.data[p]).toBe(0);
    }
  });

  it('band-reject keeps a constant image (H(0) = 1), band-pass kills it', () => {
    const src = constantFixture(16, 100);
    const rejected = bandReject(src, { center: 0.2, width: 0.1 });
    const passed = bandPass(src, { center: 0.2, width: 0.1 });
    expect(Math.abs(meanRed(rejected) - 100)).toBeLessThanOrEqual(2);
    for (let p = 0; p < passed.data.length; p += 4) expect(passed.data[p]).toBeLessThanOrEqual(2);
  });

  it('keeps dimensions and alpha of the source image', () => {
    const src = stepFixture(64, 64, 30, 200);
    for (const filter of [idealLowPass, butterworthLowPass, bandPass]) {
      const out = filter(src, { cutoff: 0.2, order: 2, center: 0.2, width: 0.1 });
      expect(out.width).toBe(64);
      expect(out.height).toBe(64);
      for (let p = 3; p < out.data.length; p += 4) expect(out.data[p]).toBe(255);
    }
  });

  it('throws when cancelled', () => {
    expect(() =>
      idealLowPass(stepFixture(16, 16, 0, 10), {}, { shouldCancel: () => true }),
    ).toThrow(EngineCancelledError);
  });
});

describe('spectrumImage', () => {
  it('shows a constant image as one bright DC dot at the centre', () => {
    const out = spectrumImage(constantFixture(16, 90), { gain: 1 });
    expect(out.width).toBe(16);
    expect(out.height).toBe(16);
    expect(getPixel(out, 8, 8)[0]).toBe(255); // DC after the shift
    expect(getPixel(out, 2, 2)[0]).toBe(0); // no other energy
  });

  it('smoothing trades isolated spikes for a readable band of values', () => {
    const src = stepFixture(16, 16, 0, 255);
    const raw = spectrumImage(src, { gain: 1 });
    const smooth = spectrumImage(src, { gain: 1, smooth: 1 });
    const spread = (image: ImageBuffer) => {
      let min = 255;
      let max = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        min = Math.min(min, image.data[i]);
        max = Math.max(max, image.data[i]);
      }
      return max - min;
    };
    // Smoothing pulls the outliers in, so the picture is less contrasty but
    // far more readable on a small photo.
    expect(spread(smooth)).toBeLessThan(spread(raw));
    expect(getPixel(smooth, 8, 8)[0]).toBeGreaterThan(0);
  });

  it('a gamma below 1 lifts the faint structure', () => {
    const src = stepFixture(16, 16, 0, 255);
    const linear = spectrumImage(src, { gain: 1 });
    const lifted = spectrumImage(src, { gain: 1, gamma: 0.5 });
    const mean = (image: ImageBuffer) => {
      let sum = 0;
      for (let i = 0; i < image.data.length; i += 4) sum += image.data[i];
      return sum / (image.data.length / 4);
    };
    expect(mean(lifted)).toBeGreaterThan(mean(linear));
  });
});
