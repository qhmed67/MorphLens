/**
 * clahe.ts — Contrast-Limited Adaptive Histogram Equalisation.
 *
 * Theory: global equalisation over-amplifies noise in flat regions because it
 * uses one histogram for the whole image. CLAHE divides the image into a
 * tiles×tiles grid, equalises each tile independently, and *limits* local
 * contrast by clipping each tile histogram at a threshold before computing
 * its CDF: the clipped excess is redistributed uniformly over all bins, so
 * no single bin can dominate and boost a flat region. Final pixel values are
 * bilinear interpolations of the four nearest tile LUTs, which removes tile
 * borders.
 *
 * Per tile t (N_t pixels, clipped histogram h):
 *   limit = clip · N_t / 256
 *   lut_t(v) = 255 · Σ_{u≤v} h(u) / N_t
 *   out(x,y) = bilinear(lut of the 4 nearest tiles, in(x,y))
 *
 * Complexity: O(T·256 + N) histogram/LUT work + O(N·4) interpolations.
 * Reference: Zuiderveld, "Contrast Limited Adaptive Histogram Equalisation",
 * Graphics Gems IV (1994); Gonzalez & Woods, "Histogram Processing".
 */
import { clampByte, pixelOffset } from '../buffer';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from '../types';

/** Progress is reported every 64 rows within each of the 3 channels. */
const PROGRESS_ROWS = 64;

/** Snap a free slider value onto the supported tile grid {4, 8, 16}. */
function snapTiles(value: number): number {
  const rounded = Math.round(value);
  if (rounded <= 6) return 4;
  if (rounded <= 12) return 8;
  return 16;
}

/**
 * CLAHE over R, G and B independently.
 *
 * @param params.tiles tile grid per axis: snapped to 4 | 8 | 16 (default 8)
 * @param params.clip  contrast limit multiplier 1..8 (default 3)
 * @param ctx progress/cancel hooks
 * @complexity O(T·256 + N)
 */
export function clahe(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const tiles = snapTiles(params.tiles ?? 8);
  const clip = Math.min(8, Math.max(1, params.clip ?? 3));
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  const tileCount = tiles * tiles;
  const tileCounts = new Uint32Array(tileCount);

  for (let channel = 0; channel < 3; channel += 1) {
    // 1) per-tile histograms (tile grid may leave smaller tiles at the edges).
    // Float bins: the clip threshold is real-valued (clip·N/256), so integer
    // bins would truncate the limit and skew redistribution.
    tileCounts.fill(0);
    const hists = new Float32Array(tileCount * 256);
    for (let y = 0; y < height; y += 1) {
      const ty = Math.min(tiles - 1, Math.floor((y * tiles) / height));
      for (let x = 0; x < width; x += 1) {
        const tx = Math.min(tiles - 1, Math.floor((x * tiles) / width));
        const tile = ty * tiles + tx;
        hists[tile * 256 + data[pixelOffset(x, y, width) + channel]] += 1;
        tileCounts[tile] += 1;
      }
    }

    // 2) clip, redistribute and build one LUT per tile.
    const luts = new Float32Array(tileCount * 256);
    for (let tile = 0; tile < tileCount; tile += 1) {
      const count = tileCounts[tile];
      if (count === 0) continue; // empty tile (grid larger than image): LUT stays 0
      const base = tile * 256;
      const limit = Math.max(1, (clip * count) / 256);
      let excess = 0;
      for (let v = 0; v < 256; v += 1) {
        const bin = hists[base + v];
        if (bin > limit) {
          excess += bin - limit;
          hists[base + v] = limit;
        }
      }
      // Uniform redistribution over all 256 bins (integer part + remainder).
      const step = excess / 256;
      const add = Math.floor(step);
      const rem = Math.round(excess - add * 256);
      for (let v = 0; v < 256; v += 1) {
        hists[base + v] += add + (v < rem ? 1 : 0);
      }
      // CDF → 0..255 mapping.
      let cum = 0;
      for (let v = 0; v < 256; v += 1) {
        cum += hists[base + v];
        luts[base + v] = (cum / count) * 255;
      }
    }

    // 3) bilinear interpolation of the four nearest tile LUTs per pixel.
    for (let y = 0; y < height; y += 1) {
      if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
      if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.((channel + y / height) / 3);
      // Pixel centre mapped into tile space; the +0.5/−0.5 keeps tile centres aligned.
      const fy = ((y + 0.5) * tiles) / height - 0.5;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const yA = Math.min(tiles - 1, Math.max(0, y0));
      const yB = Math.min(tiles - 1, Math.max(0, y0 + 1));
      for (let x = 0; x < width; x += 1) {
        const fx = ((x + 0.5) * tiles) / width - 0.5;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const xA = Math.min(tiles - 1, Math.max(0, x0));
        const xB = Math.min(tiles - 1, Math.max(0, x0 + 1));
        const baseA = yA * tiles * 256;
        const baseB = yB * tiles * 256;
        const v = data[pixelOffset(x, y, width) + channel];
        const top = luts[baseA + xA * 256 + v] * (1 - tx) + luts[baseA + xB * 256 + v] * tx;
        const bottom = luts[baseB + xA * 256 + v] * (1 - tx) + luts[baseB + xB * 256 + v] * tx;
        out[pixelOffset(x, y, width) + channel] = clampByte(top * (1 - ty) + bottom * ty);
      }
    }
  }
  // Alpha is copied in a final pass (channel loops above only write RGB).
  for (let p = 3; p < data.length; p += 4) out[p] = data[p];
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}
