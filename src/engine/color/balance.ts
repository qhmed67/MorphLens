/**
 * balance.ts — white-balance correction: gray-world and white-patch.
 *
 * Theory: the illuminant tints every pixel, so scene statistics drift away
 * from their expected values. Two classical blind estimators:
 *
 *   gray-world  the average of a correctly white-balanced scene is neutral
 *               grey → gains g_c = meanGray / mean(c)
 *   white-patch the brightest reflection of a dielectric surface is white
 *               → gains g_c = 255 / max(c)
 *
 * Both are per-channel gains blended by `strength` (0 keeps the original,
 * 1 applies the full correction). Zero means/maxes are guarded (gain 1) so a
 * black channel is never divided by zero.
 *
 * Complexity: O(N) scan + O(N) apply.
 * Reference: Gonzalez & Woods, "Colour Image Processing"; Brainard &
 * Wandell, "Analysis of computer colour illumination" (gray-world origin).
 */
import { clampByte } from '../buffer';
import type { ImageBuffer, RunCtx } from '../types';

/** Shared apply step: multiply each channel by a precomputed gain. */
function applyGains(
  src: ImageBuffer,
  gains: readonly number[],
  strength: number,
): ImageBuffer {
  const out = new Uint8ClampedArray(src.data.length);
  for (let p = 0; p < src.data.length; p += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      // Blend toward unity so strength 0 is the identity.
      const gain = 1 + strength * (gains[channel] - 1);
      out[p + channel] = clampByte(src.data[p + channel] * gain);
    }
    out[p + 3] = src.data[p + 3];
  }
  return { width: src.width, height: src.height, data: out };
}

/**
 * Gray-world white balance: neutralise the mean colour cast.
 *
 * @param params.strength 0..1 (default 1)
 * @param ctx progress/cancel hooks
 * @complexity O(N)
 */
export function grayWorldWB(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const strength = Math.min(1, Math.max(0, params.strength ?? 1));
  const pixels = src.data.length / 4;
  if (pixels === 0) return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };

  const sums = [0, 0, 0];
  for (let p = 0; p < src.data.length; p += 4) {
    sums[0] += src.data[p];
    sums[1] += src.data[p + 1];
    sums[2] += src.data[p + 2];
  }
  const means = [sums[0] / pixels, sums[1] / pixels, sums[2] / pixels];
  const gray = (means[0] + means[1] + means[2]) / 3;
  const gains = means.map((mean) => (mean > 0 ? gray / mean : 1));
  ctx?.onProgress?.(1);
  return applyGains(src, gains, strength);
}

/**
 * White-patch (max-RGB) white balance: force the brightest channel to white.
 *
 * @param params.strength 0..1 (default 1)
 * @param ctx progress/cancel hooks
 * @complexity O(N)
 */
export function whitePatchWB(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const strength = Math.min(1, Math.max(0, params.strength ?? 1));
  const maxes = [0, 0, 0];
  for (let p = 0; p < src.data.length; p += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      if (src.data[p + channel] > maxes[channel]) maxes[channel] = src.data[p + channel];
    }
  }
  const gains = maxes.map((max) => (max > 0 ? 255 / max : 1));
  ctx?.onProgress?.(1);
  return applyGains(src, gains, strength);
}
