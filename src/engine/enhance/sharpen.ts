/**
 * sharpen.ts — unsharp mask and Laplacian sharpening.
 *
 * Theory: sharpening amplifies high frequencies. The unsharp mask builds a
 * blurred (low-pass) estimate of the image and adds back the high-frequency
 * residual:
 *
 *   out = in + amount·(in − blur(in))
 *
 * The Laplacian sharpen uses the second-derivative (edge-enhancement) kernel
 * directly:
 *
 *   out = in + c·∇²in,   ∇² ≈ [0 −1 0; −1 4 −1; 0 −1 0]
 *
 * Both create an overshoot on the bright side of an edge and an undershoot
 * on the dark side — the classic sharpened "halo" — and are no-ops on flat
 * areas (the residual / the zero-sum kernel vanishes).
 *
 * Complexity: unsharp O(N·2k) (separable Gaussian); Laplacian O(N·9).
 * Reference: Gonzalez & Woods, Digital Image Processing — "Image Sharpening".
 */
import { clampByte, sampleIndex } from '../buffer';
import { gaussianFilter } from '../noise/denoise';
import { EngineCancelledError, type BorderMode, type ImageBuffer, type RunCtx } from '../types';

/**
 * Unsharp masking with a Gaussian base blur.
 *
 * @param params.amount detail gain 0..3 (default 1; 0 = identity)
 * @param params.radius Gaussian σ of the base blur 0.5..5 (default 1.4)
 * @param ctx progress/cancel hooks
 * @complexity O(W·H·2k)
 */
export function unsharpMask(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const amount = Math.min(3, Math.max(0, params.amount ?? 1));
  const radius = Math.min(5, Math.max(0.5, params.radius ?? 1.4));
  if (amount === 0) return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };

  const blur = gaussianFilter(src, { sigma: radius }, ctx);
  const { width, height } = src;
  const out = new Uint8ClampedArray(src.data.length);
  for (let p = 0; p < src.data.length; p += 4) {
    // High-frequency residual added back on top of the original.
    out[p] = clampByte(src.data[p] + amount * (src.data[p] - blur.data[p]));
    out[p + 1] = clampByte(src.data[p + 1] + amount * (src.data[p + 1] - blur.data[p + 1]));
    out[p + 2] = clampByte(src.data[p + 2] + amount * (src.data[p + 2] - blur.data[p + 2]));
    out[p + 3] = src.data[p + 3];
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/**
 * Laplacian sharpening: add c·∇²in (4-neighbour Laplacian) back to the image.
 * The pass is computed inline and kept *signed*: `convolve` clamps to bytes,
 * which would delete the negative half of ∇² (the dark-side undershoot).
 *
 * @param params.amount sharpness gain c 0..2 (default 1)
 * @param ctx progress/cancel hooks
 * @complexity O(W·H·5) per channel set (centre + 4 neighbours)
 */
export function laplacianSharpen(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
  border: BorderMode = 'clamp',
): ImageBuffer {
  const amount = Math.min(2, Math.max(0, params.amount ?? 1));
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      const up = sampleIndex(x, y - 1, width, height, border);
      const down = sampleIndex(x, y + 1, width, height, border);
      const left = sampleIndex(x - 1, y, width, height, border);
      const right = sampleIndex(x + 1, y, width, height, border);
      for (let channel = 0; channel < 3; channel += 1) {
        const centre = data[o + channel];
        // ∇² ≈ 4·centre − 4 direct neighbours (4-neighbour Laplacian).
        const lap =
          4 * centre -
          (up >= 0 ? data[up + channel] : 0) -
          (down >= 0 ? data[down + channel] : 0) -
          (left >= 0 ? data[left + channel] : 0) -
          (right >= 0 ? data[right + channel] : 0);
        out[o + channel] = clampByte(centre + amount * lap);
      }
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}
