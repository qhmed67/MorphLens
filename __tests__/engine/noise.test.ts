import {
  computeMetrics,
  createRng,
  mse,
  noiseGaussian,
  noiseSaltPepper,
  noiseSpeckle,
  psnr,
  ssim,
} from '@/engine';
import { constant, ramp } from './fixtures';

describe('seeded noise', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    const seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('is stable for the same gaussian seed and differs across seeds', () => {
    const src = constant(32, 128);
    const a = noiseGaussian(src, { sigma: 16, seed: 7 });
    const b = noiseGaussian(src, { sigma: 16, seed: 7 });
    const c = noiseGaussian(src, { sigma: 16, seed: 8 });
    expect(a.data).toEqual(b.data);
    expect(a.data).not.toEqual(c.data);
  });

  it('has approximately zero-mean gaussian noise', () => {
    const src = constant(64, 128);
    const out = noiseGaussian(src, { sigma: 16, seed: 3 });
    let sum = 0;
    let count = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      for (let ch = 0; ch < 3; ch += 1) {
        sum += out.data[i + ch] - 128;
        count += 1;
      }
    }
    expect(Math.abs(sum / count)).toBeLessThan(0.5);
  });

  it('injects salt-and-pepper at the requested rate', () => {
    const src = constant(128, 128);
    const untouched = noiseSaltPepper(src, { probability: 0, seed: 1 });
    expect(untouched.data).toEqual(src.data);
    const out = noiseSaltPepper(src, { probability: 0.1, seed: 1 });
    let changed = 0;
    for (let i = 0; i < out.data.length; i += 4) if (out.data[i] !== 128) changed += 1;
    const rate = changed / (128 * 128);
    expect(Math.abs(rate - 0.1)).toBeLessThan(0.01);
    // Impulses are pure black or white.
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i] !== 128) expect([0, 255]).toContain(out.data[i]);
    }
  });

  it('leaves the image untouched at speckle sigma 0', () => {
    const src = ramp(16, 16);
    expect(noiseSpeckle(src, { sigma: 0, seed: 5 }).data).toEqual(src.data);
  });
});

describe('metrics', () => {
  it('reports zero error for identical images', () => {
    const src = ramp(8, 8);
    expect(mse(src, src)).toBe(0);
    expect(psnr(src, src)).toBe(Infinity);
    expect(ssim(src, src)).toBe(1);
    expect(computeMetrics(src, src).psnr).toBe(Infinity);
  });

  it('computes PSNR 48.13 dB for MSE 1', () => {
    const a = constant(1, 0);
    const b = constant(1, 1);
    expect(mse(a, b)).toBe(1);
    expect(psnr(a, b)).toBeCloseTo(48.13, 2);
  });

  it('rejects size mismatches', () => {
    expect(() => mse(constant(2, 0), constant(3, 0))).toThrow(/mismatch/);
    expect(() => ssim(constant(2, 0), constant(3, 0))).toThrow(/mismatch/);
  });

  it('scores noisier images lower on SSIM', () => {
    const src = ramp(32, 32);
    const light = noiseGaussian(src, { sigma: 4, seed: 11 });
    const heavy = noiseGaussian(src, { sigma: 30, seed: 11 });
    expect(ssim(light, src)).toBeGreaterThan(ssim(heavy, src));
    expect(ssim(heavy, src)).toBeLessThan(1);
  });

  it('aggregates metrics', () => {
    const a = ramp(8, 8);
    const b = noiseGaussian(a, { sigma: 5, seed: 2 });
    const metrics = computeMetrics(a, b);
    expect(metrics.mse).toBeGreaterThan(0);
    expect(metrics.psnr).toBeLessThan(Infinity);
    expect(metrics.ssim).toBeLessThan(1);
  });
});
