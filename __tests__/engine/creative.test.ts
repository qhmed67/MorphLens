import {
  aurora,
  creativeDuotone,
  glitch,
  liquid,
  noir,
  runOperation,
  vortex,
} from '@/engine';
import { checkerboard, constant, ramp } from './fixtures';

describe('creative filters', () => {
  it('aurora only adds light and never mutates the source', () => {
    const src = ramp(32, 8);
    const before = Array.from(src.data);
    const out = aurora(src, { strength: 0.8, bands: 0.4 });
    expect(Array.from(src.data)).toEqual(before);
    let brighter = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeGreaterThanOrEqual(src.data[i]);
      if (out.data[i] > src.data[i]) brighter += 1;
    }
    expect(brighter).toBeGreaterThan(0);
  });

  it('liquid warps the image but keeps it in the same brightness range', () => {
    const src = ramp(32, 8);
    const out = liquid(src, { strength: 0.6, scale: 0.4 });
    let differs = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i] !== src.data[i]) differs += 1;
    }
    expect(differs).toBeGreaterThan(0);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeLessThanOrEqual(255);
      expect(out.data[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('vortex pulls the middle of the image outwards', () => {
    const src = checkerboard(32, 32);
    const out = vortex(src, { strength: 0.8 });
    // The exact centre maps onto itself; a ring around it is rotated.
    const offCentre = (16 * 32 + 20) * 4;
    expect(out.data[offCentre]).not.toBe(src.data[offCentre]);
  });

  it('glitch is deterministic for one seed', () => {
    const src = ramp(32, 8);
    const a = glitch(src, { strength: 0.8, seed: 3 });
    const b = glitch(src, { strength: 0.8, seed: 3 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    const c = glitch(src, { strength: 0.8, seed: 9 });
    expect(Array.from(c.data)).not.toEqual(Array.from(a.data));
  });

  it('duotone maps black and white onto the two stops', () => {
    const src = constant(4, 0);
    const dark = creativeDuotone(src, { strength: 1, shadow: 18, light: 242 });
    expect(dark.data[0]).toBe(18);
    const bright = creativeDuotone(constant(4, 255), {
      strength: 1,
      shadow: 18,
      light: 242,
    });
    expect(bright.data[0]).toBe(242);
  });

  it('noir turns the image grey and darkens the corners', () => {
    const src = ramp(32, 32);
    const out = noir(src, { strength: 1, contrast: 0.5, vignette: 0.8 });
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(out.data[i + 1]);
      expect(out.data[i + 1]).toBe(out.data[i + 2]);
    }
    const corner = out.data[0];
    const middle = out.data[(16 * 32 + 16) * 4];
    expect(corner).toBeLessThan(middle);
  });

  it('runs through the registry', () => {
    const src = constant(16, 120);
    const out = runOperation('noir', src, { strength: 1, contrast: 0.5, vignette: 0.5 });
    expect(out.data[0]).toBe(out.data[1]);
  });
});
