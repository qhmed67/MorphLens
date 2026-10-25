/**
 * metrics.ts — full-reference image quality metrics (MSE, PSNR, SSIM).
 *
 * Theory:
 *   MSE  = (1/N)Σ(a−b)² over the three colour channels.
 *   PSNR = 10·log10(255² / MSE); identical images → +∞ (returned as Infinity).
 *   SSIM compares local mean, variance and covariance on 8×8 luma windows:
 *     SSIM = (2μaμb + C1)(2σab + C2) / ((μa²+μb²+C1)(σa²+σb²+C2)),
 *     C1 = (0.01L)², C2 = (0.03L)², L = 255.
 *
 * Reference: Gonzalez & Woods, Digital Image Processing — "Image Quality Metrics".
 * (SSIM: Wang et al., 2004 — formula re-implemented, not copied.)
 */
import type { ImageBuffer, Metrics } from '../types';
import { luma } from '../color/spaces';

function assertSameSize(a: ImageBuffer, b: ImageBuffer): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`Image size mismatch: ${a.width}×${a.height} vs ${b.width}×${b.height}`);
  }
}

/**
 * Mean squared error over RGB channels.
 * @complexity O(N)
 */
export function mse(a: ImageBuffer, b: ImageBuffer): number {
  assertSameSize(a, b);
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const d = a.data[i + c] - b.data[i + c];
      sum += d * d;
    }
  }
  return sum / (a.width * a.height * 3);
}

/**
 * Peak signal-to-noise ratio in dB (255 peak). Infinity for identical images.
 * @complexity O(N)
 */
export function psnr(a: ImageBuffer, b: ImageBuffer): number {
  const value = mse(a, b);
  if (value === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / value);
}

/** Local SSIM on one block of the luma planes. */
function blockSsim(
  a: Float32Array,
  b: Float32Array,
  width: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): number {
  let count = 0;
  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const i = y * width + x;
      const va = a[i];
      const vb = b[i];
      sumA += va;
      sumB += vb;
      sumAA += va * va;
      sumBB += vb * vb;
      sumAB += va * vb;
      count += 1;
    }
  }
  const muA = sumA / count;
  const muB = sumB / count;
  const varA = sumAA / count - muA * muA;
  const varB = sumBB / count - muB * muB;
  const cov = sumAB / count - muA * muB;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  return ((2 * muA * muB + c1) * (2 * cov + c2)) /
    ((muA * muA + muB * muB + c1) * (varA + varB + c2));
}

/**
 * Mean SSIM over 8×8 luma windows (a single window for tiny fixtures).
 * Identical images return exactly 1.
 * @complexity O(N)
 */
export function ssim(a: ImageBuffer, b: ImageBuffer, window = 8): number {
  assertSameSize(a, b);
  const { width, height } = a;
  const ya = new Float32Array(width * height);
  const yb = new Float32Array(width * height);
  for (let i = 0, p = 0; i < a.data.length; i += 4, p += 1) {
    ya[p] = luma(a.data[i], a.data[i + 1], a.data[i + 2]);
    yb[p] = luma(b.data[i], b.data[i + 1], b.data[i + 2]);
  }
  const w = Math.max(1, Math.min(window, width));
  const h = Math.max(1, Math.min(window, height));
  let total = 0;
  let blocks = 0;
  for (let y = 0; y < height; y += h) {
    for (let x = 0; x < width; x += w) {
      const bw = Math.min(w, width - x);
      const bh = Math.min(h, height - y);
      total += blockSsim(ya, yb, width, x, y, bw, bh);
      blocks += 1;
    }
  }
  return total / blocks;
}

/** Bundle the three metrics for badges in the Denoise Arena. */
export function computeMetrics(a: ImageBuffer, b: ImageBuffer): Metrics {
  const error = mse(a, b);
  return {
    mse: error,
    psnr: error === 0 ? Infinity : 10 * Math.log10((255 * 255) / error),
    ssim: ssim(a, b),
  };
}
