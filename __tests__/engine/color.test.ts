import {
  brightness,
  channelMixer,
  contrast,
  duotone,
  gamma,
  getPixel,
  grayscale,
  hslToRgb,
  hsvToRgb,
  hueShift,
  invert,
  labToRgb,
  posterize,
  rgbToHsl,
  rgbToHsv,
  rgbToLab,
  rgbToYCbCr,
  saturation,
  sepia,
  ycbcrToRgb,
} from '@/engine';
import { solid } from './fixtures';

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe('colour spaces', () => {
  const samples: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [12, 200, 99],
    [128, 128, 128],
    [250, 240, 10],
    [5, 70, 180],
  ];

  it('round-trips RGB → HSV → RGB within ±1', () => {
    for (const [r, g, b] of samples) {
      const { h, s, v } = rgbToHsv(r, g, b);
      const back = hsvToRgb(h, s, v);
      expect(close(back.r, r, 1)).toBe(true);
      expect(close(back.g, g, 1)).toBe(true);
      expect(close(back.b, b, 1)).toBe(true);
    }
  });

  it('reports red as hue 0, saturation 1, value 1', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 });
  });

  it('round-trips RGB → HSL → RGB within ±1 and handles white', () => {
    for (const [r, g, b] of samples) {
      const hsl = rgbToHsl(r, g, b);
      const back = hslToRgb(hsl.h, hsl.s, hsl.l);
      expect(close(back.r, r, 1) && close(back.g, g, 1) && close(back.b, b, 1)).toBe(true);
    }
    expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 1 });
  });

  it('round-trips RGB → YCbCr → RGB and maps mid-grey to 128', () => {
    for (const [r, g, b] of samples) {
      const y = rgbToYCbCr(r, g, b);
      const back = ycbcrToRgb(y.y, y.cb, y.cr);
      expect(close(back.r, r, 1) && close(back.g, g, 1) && close(back.b, b, 1)).toBe(true);
    }
    expect(rgbToYCbCr(128, 128, 128)).toEqual({ y: 128, cb: 128, cr: 128 });
  });

  it('round-trips RGB → Lab → RGB within ±2 and puts white at L≈100', () => {
    for (const [r, g, b] of samples) {
      const lab = rgbToLab(r, g, b);
      const back = labToRgb(lab.l, lab.a, lab.b);
      expect(close(back.r, r, 2) && close(back.g, g, 2) && close(back.b, b, 2)).toBe(true);
    }
    const white = rgbToLab(255, 255, 255);
    expect(close(white.l, 100, 0.1)).toBe(true);
    expect(close(white.a, 0, 0.1)).toBe(true);
    expect(close(white.b, 0, 0.1)).toBe(true);
  });
});

describe('colour adjustments', () => {
  it('adds brightness (128 + 50 = 178) and preserves alpha', () => {
    const src = solid(1, 1, [128, 20, 240, 77]);
    const out = brightness(src, { amount: 50 });
    expect(getPixel(out, 0, 0)).toEqual([178, 70, 255, 77]);
  });

  it('scales contrast around 128', () => {
    const pivot = contrast(solid(1, 1, [128, 128, 128, 255]), { amount: 2 });
    expect(getPixel(pivot, 0, 0)[0]).toBe(128);
    const up = contrast(solid(1, 1, [160, 160, 160, 255]), { amount: 2 });
    expect(getPixel(up, 0, 0)[0]).toBe(192);
  });

  it('applies gamma 2 to 64 as 128', () => {
    const out = gamma(solid(1, 1, [64, 64, 64, 255]), { amount: 2 });
    expect(getPixel(out, 0, 0)[0]).toBe(128);
  });

  it('desaturates pure red to luma 54', () => {
    const out = saturation(solid(1, 1, [255, 0, 0, 255]), { amount: 0 });
    expect(getPixel(out, 0, 0)).toEqual([54, 54, 54, 255]);
  });

  it('leaves grey invariant under saturation', () => {
    const out = saturation(solid(1, 1, [90, 90, 90, 255]), { amount: 2 });
    expect(getPixel(out, 0, 0)).toEqual([90, 90, 90, 255]);
  });

  it('rotates red by 120° to green', () => {
    const out = hueShift(solid(1, 1, [255, 0, 0, 255]), { degrees: 120 });
    const [r, g, b] = getPixel(out, 0, 0);
    expect(close(r, 0, 2) && close(g, 255, 2) && close(b, 0, 2)).toBe(true);
  });
});

describe('colour effects', () => {
  it('maps pure red to grey 54 and keeps alpha', () => {
    const out = grayscale(solid(1, 1, [255, 0, 0, 99]));
    expect(getPixel(out, 0, 0)).toEqual([54, 54, 54, 99]);
  });

  it('produces the classic sepia white (255,255,239)', () => {
    const out = sepia(solid(1, 1, [255, 255, 255, 255]), { amount: 1 });
    expect(getPixel(out, 0, 0)).toEqual([255, 255, 239, 255]);
  });

  it('inverts black to white', () => {
    const out = invert(solid(1, 1, [0, 0, 0, 255]));
    expect(getPixel(out, 0, 0)).toEqual([255, 255, 255, 255]);
  });

  it('keeps identity channel-mixer output equal to input', () => {
    const src = solid(1, 1, [12, 34, 56, 255]);
    const out = channelMixer(src, {});
    expect(getPixel(out, 0, 0)).toEqual([12, 34, 56, 255]);
  });

  it('maps duotone extremes to the palette endpoints', () => {
    const dark = duotone(solid(1, 1, [0, 0, 0, 255]), {});
    const light = duotone(solid(1, 1, [255, 255, 255, 255]), {});
    expect(getPixel(dark, 0, 0)).toEqual([10, 10, 30, 255]);
    expect(getPixel(light, 0, 0)).toEqual([244, 244, 248, 255]);
  });

  it('posterizes 200 with 2 levels to 255', () => {
    const out = posterize(solid(1, 1, [200, 200, 200, 255]), { levels: 2 });
    expect(getPixel(out, 0, 0)[0]).toBe(255);
  });

  it('never mutates its input', () => {
    const src = solid(1, 1, [1, 2, 3, 255]);
    brightness(src, { amount: 100 });
    grayscale(src);
    invert(src);
    expect(getPixel(src, 0, 0)).toEqual([1, 2, 3, 255]);
  });
});
