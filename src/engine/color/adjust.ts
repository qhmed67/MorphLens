/**
 * adjust.ts — point-wise colour adjustments (brightness, contrast, gamma,
 * saturation, hue rotation).
 *
 * Theory: each operation is a per-pixel transfer function T(v); no spatial
 * neighbourhood is involved, so cost is O(N) and operations compose in any
 * order (though the visual result differs).
 *
 * Formulas:
 *   brightness: out = clamp(in + b)
 *   contrast:   out = (in − 128)·c + 128
 *   gamma:      out = 255·(in/255)^(1/γ)
 *   saturation: out = luma + s·(in − luma), luma = .2126R+.7152G+.0722B
 *   hue shift:  rotate H in HSV by θ degrees, keep S,V.
 *
 * Reference: Gonzalez & Woods, Digital Image Processing — "Intensity Transformations".
 */
import { clampByte } from '../buffer';
import type { ImageBuffer } from '../types';
import { hsvToRgb, luma, rgbToHsv } from './spaces';

function num(params: Record<string, number>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Add a constant to every RGB channel (alpha unchanged).
 * @param params.amount offset in −100..100
 * @complexity O(W·H)
 */
export function brightness(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const amount = num(params, 'amount', 0);
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    data[i] = clampByte(src.data[i] + amount);
    data[i + 1] = clampByte(src.data[i + 1] + amount);
    data[i + 2] = clampByte(src.data[i + 2] + amount);
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Scale RGB around the mid-grey pivot 128.
 * @param params.amount contrast factor (1 = identity)
 * @complexity O(W·H)
 */
export function contrast(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const amount = num(params, 'amount', 1);
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    data[i] = clampByte((src.data[i] - 128) * amount + 128);
    data[i + 1] = clampByte((src.data[i + 1] - 128) * amount + 128);
    data[i + 2] = clampByte((src.data[i + 2] - 128) * amount + 128);
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Apply the sRGB-ish gamma curve out = 255·(in/255)^(1/γ).
 * @param params.amount γ in 0.2..5 (1 = identity)
 * @complexity O(W·H)
 */
export function gamma(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const amount = num(params, 'amount', 1);
  const inverse = 1 / Math.max(amount, 0.01);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) lut[v] = clampByte(255 * Math.pow(v / 255, inverse));
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    data[i] = lut[src.data[i]];
    data[i + 1] = lut[src.data[i + 1]];
    data[i + 2] = lut[src.data[i + 2]];
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Scale chroma around the pixel's luma.
 * @param params.amount saturation multiplier (0 = grayscale, 1 = identity)
 * @complexity O(W·H)
 */
export function saturation(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const amount = num(params, 'amount', 1);
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    const y = luma(r, g, b);
    data[i] = clampByte(y + amount * (r - y));
    data[i + 1] = clampByte(y + amount * (g - y));
    data[i + 2] = clampByte(y + amount * (b - y));
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Rotate hue in HSV, preserving saturation and value.
 * @param params.degrees rotation in −180..180
 * @complexity O(W·H)
 */
export function hueShift(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const degrees = num(params, 'degrees', 0);
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const hsv = rgbToHsv(src.data[i], src.data[i + 1], src.data[i + 2]);
    const rgb = hsvToRgb(hsv.h + degrees, hsv.s, hsv.v);
    data[i] = rgb.r;
    data[i + 1] = rgb.g;
    data[i + 2] = rgb.b;
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}
