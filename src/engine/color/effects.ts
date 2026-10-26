/**
 * effects.ts — stylistic point operations (grayscale, sepia, invert, channel
 * mixer, duotone, posterize).
 *
 * Theory: all are per-pixel mappings. Grayscale projects RGB onto the luma
 * axis; sepia and the channel mixer apply a 3×3 matrix; duotone maps luma to a
 * two-colour ramp; posterize quantises each channel.
 *
 * Reference: Gonzalez & Woods, Digital Image Processing — "Intensity Transformations".
 */
import { clampByte } from '../buffer';
import type { ImageBuffer } from '../types';
import { luma } from './spaces';

function num(params: Record<string, number>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Rec. 709 luma → neutral gray.
 * @complexity O(W·H)
 */
export function grayscale(src: ImageBuffer): ImageBuffer {
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const y = clampByte(luma(src.data[i], src.data[i + 1], src.data[i + 2]));
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Classic sepia matrix, blended by strength.
 * @param params.amount 0..1 blend toward full sepia
 * @complexity O(W·H)
 */
export function sepia(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const amount = Math.min(1, Math.max(0, num(params, 'amount', 1)));
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    const sr = 0.393 * r + 0.769 * g + 0.189 * b;
    const sg = 0.349 * r + 0.686 * g + 0.168 * b;
    const sb = 0.272 * r + 0.534 * g + 0.131 * b;
    data[i] = clampByte(r + (sr - r) * amount);
    data[i + 1] = clampByte(g + (sg - g) * amount);
    data[i + 2] = clampByte(b + (sb - b) * amount);
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Negate every RGB channel: out = 255 − in.
 * @complexity O(W·H)
 */
export function invert(src: ImageBuffer): ImageBuffer {
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    data[i] = 255 - src.data[i];
    data[i + 1] = 255 - src.data[i + 1];
    data[i + 2] = 255 - src.data[i + 2];
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/** Identity coefficients for the channel mixer (row-major). */
export const CHANNEL_MIXER_IDENTITY = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
] as const;

/**
 * Multiply RGB by a 3×3 matrix (row-major m00..m22).
 * @param params.m00…m22 coefficients in −2..2
 * @complexity O(W·H)
 */
export function channelMixer(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const m = CHANNEL_MIXER_IDENTITY.map((fallback, index) => {
    const key = `m${Math.floor(index / 3)}${index % 3}`;
    return num(params, key, fallback);
  });
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    data[i] = clampByte(m[0] * r + m[1] * g + m[2] * b);
    data[i + 1] = clampByte(m[3] * r + m[4] * g + m[5] * b);
    data[i + 2] = clampByte(m[6] * r + m[7] * g + m[8] * b);
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/** Duotone ramp endpoints (indexed by the numeric params darkIndex/lightIndex). */
export const DUOTONE_PALETTE = [
  [10, 10, 30],
  [20, 20, 31],
  [139, 92, 255],
  [34, 211, 238],
  [255, 77, 157],
  [255, 181, 71],
  [244, 244, 248],
] as const;

/**
 * Map luma through a two-colour ramp.
 * @param params.darkIndex palette index for luma 0 (0..6)
 * @param params.lightIndex palette index for luma 255 (0..6)
 * @complexity O(W·H)
 */
export function duotone(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const dark = DUOTONE_PALETTE[Math.round(num(params, 'darkIndex', 0))] ?? DUOTONE_PALETTE[0];
  const light =
    DUOTONE_PALETTE[Math.round(num(params, 'lightIndex', 6))] ?? DUOTONE_PALETTE[6];
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const t = luma(src.data[i], src.data[i + 1], src.data[i + 2]) / 255;
    data[i] = clampByte(dark[0] + (light[0] - dark[0]) * t);
    data[i + 1] = clampByte(dark[1] + (light[1] - dark[1]) * t);
    data[i + 2] = clampByte(dark[2] + (light[2] - dark[2]) * t);
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}

/**
 * Quantise each channel into `levels` evenly spaced values.
 * @param params.levels 2..32
 * @complexity O(W·H)
 */
export function posterize(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const levels = Math.max(2, Math.round(num(params, 'levels', 6)));
  const step = levels - 1;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) lut[v] = clampByte((Math.round((v / 255) * step) / step) * 255);
  const data = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    data[i] = lut[src.data[i]];
    data[i + 1] = lut[src.data[i + 1]];
    data[i + 2] = lut[src.data[i + 2]];
    data[i + 3] = src.data[i + 3];
  }
  return { width: src.width, height: src.height, data };
}
