/**
 * lut.ts — apply a 256-entry tone map to every RGB channel.
 *
 * Theory: a tone curve is just a lookup table (LUT) from input intensity to
 * output intensity. The curve editor builds this table once; applying it is a
 * single O(N) pass, which makes live dragging cheap and deterministic.
 *
 * Complexity: O(N) time, O(N) output — no per-pixel interpolation.
 * Edge cases: values are clamped to 0..255; alpha is copied untouched; a LUT
 * that is not exactly 256 entries is rejected rather than silently indexed.
 */
import { clampByte } from '../buffer';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from '../types';

/** Rows between cancellation/progress checks for this cheap pass. */
const PROGRESS_ROWS = 64;

/**
 * Apply a 256-entry RGB tone map.
 *
 * @param src source RGBA pixels
 * @param lut 256 output intensities, indexed by the input 0..255 value
 * @param ctx progress/cancel hooks
 * @returns a new RGBA buffer; `src` is never mutated
 * @complexity O(W·H)
 */
export function applyLut(
  src: ImageBuffer,
  lut: ArrayLike<number>,
  ctx?: RunCtx,
): ImageBuffer {
  if (lut.length !== 256) {
    throw new Error(`applyLut expects a 256-entry LUT, received ${lut.length}`);
  }

  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0, p = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1, p += 4) {
      out[p] = clampByte(lut[data[p]]);
      out[p + 1] = clampByte(lut[data[p + 1]]);
      out[p + 2] = clampByte(lut[data[p + 2]]);
      out[p + 3] = data[p + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}
