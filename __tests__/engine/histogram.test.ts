import { cdf, equalize, histogram } from '@/engine';
import { constant as solid, ramp } from './fixtures';

describe('histogram', () => {
  it('counts a constant 8×8 grey 128 into bin 128', () => {
    const h = histogram(solid(8, 128), 256);
    expect(h.luma[128]).toBe(64);
    expect(h.r[128]).toBe(64);
    expect(h.g[128]).toBe(64);
    expect(h.b[128]).toBe(64);
  });

  it('respects a reduced bin count', () => {
    const h = histogram(solid(4, 200), 64);
    expect(h.bins).toBe(64);
    expect(h.luma[50]).toBe(16);
  });

  it('normalises the CDF monotonically to 1', () => {
    const c = cdf([1, 1, 2, 4]);
    expect(Array.from(c)).toEqual([0.125, 0.25, 0.5, 1]);
    for (let i = 1; i < c.length; i += 1) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
    expect(c[c.length - 1]).toBe(1);
  });

  it('returns a zero CDF for an empty histogram', () => {
    expect(Array.from(cdf(new Uint32Array(4)))).toEqual([0, 0, 0, 0]);
  });
});

describe('equalize', () => {
  it('spreads a ramp across the full range', () => {
    const src = ramp(128, 32);
    const out = equalize(src);
    let min = 255;
    let max = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      min = Math.min(min, out.data[i]);
      max = Math.max(max, out.data[i]);
    }
    expect(min).toBeLessThan(5);
    expect(max).toBeGreaterThan(250);
  });

  it('maps a constant image to white (CDF is a step)', () => {
    const out = equalize(solid(8, 128));
    expect(Array.from(out.data).every((v, i) => (i % 4 === 3 ? v === 255 : v === 255))).toBe(true);
  });

  it('supports per-channel mode', () => {
    const src = ramp(64, 8);
    const out = equalize(src, { mode: 1 });
    expect(out.width).toBe(64);
    expect(out.height).toBe(8);
    expect(out.data.length).toBe(src.data.length);
  });
});
