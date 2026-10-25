/**
 * stretch.ts — linear contrast stretching (auto-levels).
 *
 * Theory: the observed intensities of a photo may occupy only part of the
 * 0..255 range. A linear point map rescales [min, max] onto [0, 255]:
 *
 *   out(v) = (v − min)/(max − min) · 255
 *
 * The range can be measured on Rec.709 luma (one map for all channels, hue
 * preserved) or per channel (auto-levels: each channel stretches on its own,
 * which also neutralises colour casts but can shift hues).
 *
 * Complexity: O(N) for the scan + O(N) for the map.
 * Reference: Gonzalez & Woods, Digital Image Processing — "Contrast
 * Stretching".
 */
import { clampByte } from '../buffer';
import { luma } from '../color/spaces';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from '../types';

/** Progress is reported every 64 rows (this op is a cheap single pass). */
const PROGRESS_ROWS = 64;

/**
 * Contrast stretch over the observed range.
 *
 * @param params.mode 0 = luma range for all channels, 1 = per channel (default 0)
 * @param ctx progress/cancel hooks
 * @complexity O(N)
 */
export function contrastStretch(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const perChannel = (params.mode ?? 0) >= 0.5;
  const { width, height, data } = src;

  // 1) observe the range.
  let lumaMin = 255;
  let lumaMax = 0;
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (let p = 0, i = 0; p < data.length; p += 4, i += 1) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const y = luma(r, g, b);
    if (y < lumaMin) lumaMin = y;
    if (y > lumaMax) lumaMax = y;
    for (let channel = 0; channel < 3; channel += 1) {
      const v = data[p + channel];
      if (v < min[channel]) min[channel] = v;
      if (v > max[channel]) max[channel] = v;
    }
  }

  // 2) build the 1-D maps. A degenerate range (flat image/channel) is identity.
  const map = new Float32Array(3 * 256);
  for (let channel = 0; channel < 3; channel += 1) {
    const lo = perChannel ? min[channel] : lumaMin;
    const hi = perChannel ? max[channel] : lumaMax;
    const scale = hi > lo ? 255 / (hi - lo) : 0;
    for (let v = 0; v < 256; v += 1) {
      map[channel * 256 + v] = scale === 0 ? v : (v - lo) * scale;
    }
  }

  // 3) apply.
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0, p = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1, p += 4) {
      out[p] = clampByte(map[data[p]]);
      out[p + 1] = clampByte(map[256 + data[p + 1]]);
      out[p + 2] = clampByte(map[512 + data[p + 2]]);
      out[p + 3] = data[p + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/**
 * Auto-levels: per-channel contrast stretch (the classic "Levels → Auto").
 *
 * @param params ignored; present so the function matches the OperationDef.run shape
 * @param ctx progress/cancel hooks
 * @complexity O(N)
 */
export function autoLevels(
  src: ImageBuffer,
  params: Record<string, number> = {},
  ctx?: RunCtx,
): ImageBuffer {
  void params; // no tunables: auto-levels always stretches per channel
  return contrastStretch(src, { mode: 1 }, ctx);
}
