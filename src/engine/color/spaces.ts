/**
 * spaces.ts — colour-space conversions (RGB ↔ HSV, HSL, YCbCr, CIE Lab D65).
 *
 * Theory: RGB is device-friendly but not perceptually uniform. HSV/HSL expose
 * hue and chroma; YCbCr separates luma from chroma (BT.601); CIE Lab
 * approximates human perception and is used for colour transfer and distance.
 *
 * Formulas (0..255 inputs):
 *   HSV: V = max, S = (max−min)/max, H by sector (0..360).
 *   YCbCr (BT.601): Y = .299R+.587G+.114B, Cb/Cr = 128 ± chroma.
 *   Lab: sRGB → linear → XYZ (D65) → f(t) → L,a,b.
 *
 * Complexity: O(1) per pixel; O(W·H) for callers that loop.
 * Reference: Gonzalez & Woods, Digital Image Processing — "Color Image Processing".
 */

export type RGB = { r: number; g: number; b: number };
export type HSV = { h: number; s: number; v: number };
export type HSL = { h: number; s: number; l: number };
export type YCbCr = { y: number; cb: number; cr: number };
export type Lab = { l: number; a: number; b: number };

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** Rec. 709 relative luma used by grayscale, saturation and SSIM. */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Convert RGB (0..255) to HSV (h in 0..360, s/v in 0..1). */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Convert HSV back to RGB (rounded 0..255). */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hue < 60) [rp, gp, bp] = [c, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, c, 0];
  else if (hue < 180) [rp, gp, bp] = [0, c, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, c];
  else if (hue < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return { r: clamp255((rp + m) * 255), g: clamp255((gp + m) * 255), b: clamp255((bp + m) * 255) };
}

/** Convert RGB to HSL (h in 0..360, s/l in 0..1). */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

/** Convert HSL back to RGB (rounded 0..255). */
export function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const lig = clamp01(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hue < 60) [rp, gp, bp] = [c, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, c, 0];
  else if (hue < 180) [rp, gp, bp] = [0, c, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, c];
  else if (hue < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return { r: clamp255((rp + m) * 255), g: clamp255((gp + m) * 255), b: clamp255((bp + m) * 255) };
}

/** Convert RGB to YCbCr using the BT.601 matrix. */
export function rgbToYCbCr(r: number, g: number, b: number): YCbCr {
  return {
    y: clamp255(0.299 * r + 0.587 * g + 0.114 * b),
    cb: clamp255(128 - 0.168736 * r - 0.331264 * g + 0.5 * b),
    cr: clamp255(128 + 0.5 * r - 0.418688 * g - 0.081312 * b),
  };
}

/** Convert YCbCr back to RGB (BT.601 inverse). */
export function ycbcrToRgb(y: number, cb: number, cr: number): RGB {
  return {
    r: clamp255(y + 1.402 * (cr - 128)),
    g: clamp255(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)),
    b: clamp255(y + 1.772 * (cb - 128)),
  };
}

/** sRGB transfer function: 8-bit channel → linear 0..1. */
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Inverse sRGB transfer function: linear 0..1 → 8-bit channel. */
function linearToSrgb(value: number): number {
  const v = clamp01(value);
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp255(c * 255);
}

const D65_XN = 0.95047;
const D65_YN = 1.0;
const D65_ZN = 1.08883;

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labFInverse(t: number): number {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}

/** Convert sRGB (0..255) to CIE Lab under D65. */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
  const z = 0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl;
  const fx = labF(x / D65_XN);
  const fy = labF(y / D65_YN);
  const fz = labF(z / D65_ZN);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Convert CIE Lab (D65) back to sRGB (rounded 0..255). */
export function labToRgb(l: number, a: number, b: number): RGB {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = D65_XN * labFInverse(fx);
  const y = D65_YN * labFInverse(fy);
  const z = D65_ZN * labFInverse(fz);
  const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gl = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return { r: linearToSrgb(rl), g: linearToSrgb(gl), b: linearToSrgb(bl) };
}
