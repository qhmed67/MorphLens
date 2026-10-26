/**
 * histogram.ts — intensity histograms, CDF and global equalisation.
 *
 * Theory: the histogram h(v) counts pixels per intensity. Its normalised
 * cumulative distribution c(v) = Σ_{u≤v} h(u)/N is the discrete CDF; mapping
 * v ↦ round(255·c(v)) spreads intensities evenly (histogram equalisation).
 *
 * Complexity: O(N + bins).
 * Reference: Gonzalez & Woods, Digital Image Processing — "Histogram Processing".
 */
import { clampByte, cloneImageBuffer } from '../buffer';
import type { ImageBuffer } from '../types';
import { luma } from '../color/spaces';

export type Histogram = {
  bins: number;
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  luma: Uint32Array;
};

/** Convert an 8-bit value to a histogram bin index. */
function binOf(value: number, bins: number): number {
  const index = Math.floor((value / 256) * bins);
  return index < 0 ? 0 : index >= bins ? bins - 1 : index;
}

/**
 * Count R, G, B and Rec.709 luma samples per bin.
 * @param bins 32 | 64 | 128 | 256 (any value ≥ 2 works)
 * @complexity O(N)
 */
export function histogram(src: ImageBuffer, bins = 256): Histogram {
  const count = Math.max(2, Math.round(bins));
  const r = new Uint32Array(count);
  const g = new Uint32Array(count);
  const b = new Uint32Array(count);
  const y = new Uint32Array(count);
  for (let i = 0; i < src.data.length; i += 4) {
    const rr = src.data[i];
    const gg = src.data[i + 1];
    const bb = src.data[i + 2];
    r[binOf(rr, count)] += 1;
    g[binOf(gg, count)] += 1;
    b[binOf(bb, count)] += 1;
    y[binOf(clampByte(luma(rr, gg, bb)), count)] += 1;
  }
  return { bins: count, r, g, b, luma: y };
}

/**
 * Normalised cumulative distribution of a histogram (0..1).
 * @complexity O(bins)
 */
export function cdf(values: ArrayLike<number>): Float32Array {
  const out = new Float32Array(values.length);
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i];
  if (total === 0) return out;
  let running = 0;
  for (let i = 0; i < values.length; i += 1) {
    running += values[i];
    out[i] = running / total;
  }
  return out;
}

/**
 * Global histogram equalisation.
 *
 * Luma mode shifts R,G,B by the same delta so hue is preserved; per-channel
 * mode equalises each channel independently (stronger, can shift colour).
 *
 * @param params.mode 0 = luma (default), 1 = per-channel
 * @complexity O(N + bins)
 */
export function equalize(src: ImageBuffer, params: Record<string, number> = {}): ImageBuffer {
  const mode = Math.round(params.mode ?? 0);
  const out = cloneImageBuffer(src);
  const data = out.data;
  if (mode === 1) {
    const h = histogram(src, 256);
    const maps = [cdf(h.r), cdf(h.g), cdf(h.b)];
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c += 1) {
        data[i + c] = clampByte(maps[c][data[i + c]] * 255);
      }
    }
    return out;
  }

  const h = histogram(src, 256);
  const map = cdf(h.luma);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = clampByte(luma(r, g, b));
    const target = clampByte(map[y] * 255);
    const delta = target - y;
    data[i] = clampByte(r + delta);
    data[i + 1] = clampByte(g + delta);
    data[i + 2] = clampByte(b + delta);
  }
  return out;
}
