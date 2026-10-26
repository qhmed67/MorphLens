/**
 * denoise.ts — neighbourhood filters for noise reduction (mean, Gaussian,
 * median, adaptive median, bilateral).
 *
 * Theory: sensor noise is local and uncorrelated while image structure is
 * locally correlated, so averaging a neighbourhood raises the local SNR.
 * The mean filter is the plain average (box); the Gaussian filter weights
 * taps by distance; the median filter is a rank-order filter that deletes
 * impulsive (salt-and-pepper) noise without blurring edges; the adaptive
 * median grows its window only around impulses so flat areas never blur;
 * the bilateral filter adds a range term so only *similar* intensities are
 * averaged, preserving step edges.
 *
 * Formulas (window W of k×k taps around (x, y)):
 *   mean      out = (1/|W|)·Σ_W p
 *   gaussian  out = Σ w·p / Σ w,  w(s,t) = exp(−(s²+t²)/(2σ²))
 *   median    out = median{p(s,t)}
 *   adaptive  grow k until min < median < max; else fall back to the median
 *   bilateral out = Σ ws·wr·p / Σ ws·wr, ws = exp(−(s²+t²)/(2σs²)),
 *             wr = exp(−ΔI²/(2σr²))  (ΔI compared on Rec.709 luma)
 *
 * Complexity: mean O(N·k²); gaussian O(N·2k) separable; median O(N·k²);
 * adaptive median O(N·Σ k²) worst case; bilateral O(N·k²) with radius ∝ σs
 * (capped at 5 so a 512² proxy stays in the interactive budget).
 * Reference: Gonzalez & Woods, Digital Image Processing — "Smoothing
 * Spatial Filters"; Tomasi & Manduchi, "Bilateral Filtering for Gray and
 * Color Images", ICCV 1998.
 */
import { clampByte, pixelOffset, sampleIndex } from '../buffer';
import { gaussianKernel1D } from '../spatial/kernels';
import { separableConvolve } from '../spatial/convolve';
import { EngineCancelledError, type BorderMode, type ImageBuffer, type RunCtx } from '../types';
import { luma } from '../color/spaces';

/** Progress is reported every N rows to keep callback overhead negligible. */
const PROGRESS_ROWS = 16;

/** Largest bilateral window radius: bounds cost at O(N·121) per pixel set. */
const BILATERAL_MAX_RADIUS = 5;

/**
 * Round a window-size parameter to the nearest odd integer inside [min, max]
 * (both ends odd). Even slider values step down so the window stays centred.
 */
function oddWindow(value: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, Math.round(value)));
  return clamped % 2 === 0 ? Math.max(min, clamped - 1) : clamped;
}

/** Throw if cancelled; report coarse row-band progress. */
function tick(ctx: RunCtx | undefined, y: number, height: number, scale = 1): void {
  if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
  if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.((y / height) * scale);
}

/**
 * Box (mean) filter: arithmetic average of the k×k neighbourhood.
 *
 * @param params.k window size 3..9 (odd; default 3)
 * @param ctx progress/cancel hooks
 * @param border window sampling policy (default clamp)
 * @complexity O(W·H·k²)
 */
export function meanFilter(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
  border: BorderMode = 'clamp',
): ImageBuffer {
  const k = oddWindow(params.k ?? 3, 3, 9);
  const half = (k - 1) / 2;
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    tick(ctx, y, height);
    for (let x = 0; x < width; x += 1) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let ky = 0; ky < k; ky += 1) {
        const sy = y + ky - half;
        for (let kx = 0; kx < k; kx += 1) {
          const index = sampleIndex(x + kx - half, sy, width, height, border);
          if (index < 0) continue; // `zero` border: outside taps contribute 0 but still count in k²
          sumR += data[index];
          sumG += data[index + 1];
          sumB += data[index + 2];
        }
      }
      const o = pixelOffset(x, y, width);
      const inv = 1 / (k * k);
      out[o] = clampByte(sumR * inv);
      out[o + 1] = clampByte(sumG * inv);
      out[o + 2] = clampByte(sumB * inv);
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/**
 * Gaussian blur via two separable 1-D passes (rows then columns).
 * Kernel radius is ceil(3σ), capped at 10 taps each side for the proxy budget.
 *
 * @param params.sigma standard deviation 0.5..5 (default 1.4)
 * @param ctx progress/cancel hooks
 * @param border window sampling policy (default clamp)
 * @complexity O(W·H·2k)
 */
export function gaussianFilter(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
  border: BorderMode = 'clamp',
): ImageBuffer {
  const sigma = Math.min(5, Math.max(0.5, params.sigma ?? 1.4));
  const radius = Math.min(10, Math.max(1, Math.ceil(3 * sigma)));
  const kernel = gaussianKernel1D(sigma, 2 * radius + 1);
  return separableConvolve(src, kernel, kernel, border, ctx);
}

/**
 * Median filter using per-window 256-bin histograms (no sorting): three
 * counts arrays are filled by one window walk, walked to the (lower) median,
 * then symmetrically decremented so they stay zero for the next pixel.
 *
 * @param params.k window size 3..7 (odd; default 3)
 * @param ctx progress/cancel hooks
 * @param border window sampling policy — `reflect` keeps parity-sensitive
 *               patterns (e.g. checkerboards) intact at the border
 * @complexity O(W·H·k² + W·H·3·bins)
 */
export function medianFilter(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
  border: BorderMode = 'clamp',
): ImageBuffer {
  const k = oddWindow(params.k ?? 3, 3, 7);
  const half = (k - 1) / 2;
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  const countR = new Uint32Array(256);
  const countG = new Uint32Array(256);
  const countB = new Uint32Array(256);

  for (let y = 0; y < height; y += 1) {
    tick(ctx, y, height);
    for (let x = 0; x < width; x += 1) {
      // 1) fill histograms over the window.
      let total = 0;
      for (let ky = 0; ky < k; ky += 1) {
        const sy = y + ky - half;
        for (let kx = 0; kx < k; kx += 1) {
          const index = sampleIndex(x + kx - half, sy, width, height, border);
          if (index < 0) continue;
          countR[data[index]] += 1;
          countG[data[index + 1]] += 1;
          countB[data[index + 2]] += 1;
          total += 1;
        }
      }
      // 2) walk each channel to its (lower) median value.
      // Odd windows are the normal case; a `zero` border can shrink the
      // window, and then we take the lower middle sample.
      const target = (total + 1) >> 1;
      const med = [0, 0, 0];
      const counts = [countR, countG, countB];
      for (let channel = 0; channel < 3; channel += 1) {
        const table = counts[channel];
        let acc = 0;
        for (let v = 0; v < 256; v += 1) {
          acc += table[v];
          if (acc >= target) {
            med[channel] = v;
            break;
          }
        }
      }
      // 3) symmetric decrement restores all counts to zero for the next pixel.
      for (let ky = 0; ky < k; ky += 1) {
        const sy = y + ky - half;
        for (let kx = 0; kx < k; kx += 1) {
          const index = sampleIndex(x + kx - half, sy, width, height, border);
          if (index < 0) continue;
          countR[data[index]] -= 1;
          countG[data[index + 1]] -= 1;
          countB[data[index + 2]] -= 1;
        }
      }
      const o = pixelOffset(x, y, width);
      out[o] = med[0];
      out[o + 1] = med[1];
      out[o + 2] = med[2];
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/**
 * Adaptive median (Zhao-style): for each channel, grow the window from 3 to
 * kMax and stop as soon as the window median is non-extreme
 * (min < median < max). A centre sample inside (min, max) is kept unchanged
 * (edges survive); impulses fall back to the window median. If no level makes
 * the median non-extreme, the kMax median is used.
 *
 * @param params.kMax largest odd window 3..11 (default 7)
 * @param ctx progress/cancel hooks
 * @param border window sampling policy (default clamp)
 * @complexity O(W·H·Σ_{k=3..kMax} k²) worst case, much less in flat areas
 */
export function adaptiveMedian(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
  border: BorderMode = 'clamp',
): ImageBuffer {
  const kMax = oddWindow(params.kMax ?? 7, 3, 11);
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  const countR = new Uint32Array(256);
  const countG = new Uint32Array(256);
  const countB = new Uint32Array(256);
  const counts = [countR, countG, countB];

  for (let y = 0; y < height; y += 1) {
    tick(ctx, y, height);
    for (let x = 0; x < width; x += 1) {
      const o = pixelOffset(x, y, width);
      const center = [data[o], data[o + 1], data[o + 2]];
      const result = [center[0], center[1], center[2]];
      const done = [false, false, false];

      for (let size = 3; size <= kMax; size += 1) {
        // Only odd windows are analysed (3, 5, 7 … kMax).
        if (size % 2 === 0) continue;
        const half = (size - 1) / 2;
        // Fill histograms and min/max in one walk.
        let total = 0;
        const mins = [255, 255, 255];
        const maxs = [0, 0, 0];
        for (let ky = 0; ky < size; ky += 1) {
          const sy = y + ky - half;
          for (let kx = 0; kx < size; kx += 1) {
            const index = sampleIndex(x + kx - half, sy, width, height, border);
            if (index < 0) continue;
            for (let channel = 0; channel < 3; channel += 1) {
              const v = data[index + channel];
              counts[channel][v] += 1;
              if (v < mins[channel]) mins[channel] = v;
              if (v > maxs[channel]) maxs[channel] = v;
            }
            total += 1;
          }
        }
        // Walk to the median per channel.
        const target = (total + 1) >> 1;
        const med = [0, 0, 0];
        for (let channel = 0; channel < 3; channel += 1) {
          const table = counts[channel];
          let acc = 0;
          for (let v = 0; v < 256; v += 1) {
            acc += table[v];
            if (acc >= target) {
              med[channel] = v;
              break;
            }
          }
        }
        // Symmetric decrement restores the tables to zero.
        for (let ky = 0; ky < size; ky += 1) {
          const sy = y + ky - half;
          for (let kx = 0; kx < size; kx += 1) {
            const index = sampleIndex(x + kx - half, sy, width, height, border);
            if (index < 0) continue;
            for (let channel = 0; channel < 3; channel += 1) {
              counts[channel][data[index + channel]] -= 1;
            }
          }
        }
        // Decide per channel at this level.
        const lastLevel = size + 2 > kMax;
        for (let channel = 0; channel < 3; channel += 1) {
          if (done[channel]) continue;
          const min = mins[channel];
          const max = maxs[channel];
          if (min < med[channel] && med[channel] < max) {
            // Non-extreme median: keep the centre unless it is an impulse.
            result[channel] = min < center[channel] && center[channel] < max ? center[channel] : med[channel];
            done[channel] = true;
          } else if (lastLevel) {
            // Exhausted: fall back to the largest window's median.
            result[channel] = med[channel];
            done[channel] = true;
          }
        }
        if (done[0] && done[1] && done[2]) break;
      }

      out[o] = result[0];
      out[o + 1] = result[1];
      out[o + 2] = result[2];
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/**
 * Bilateral filter: Gaussian spatial weights multiplied by a range term that
 * decays with the Rec.709-luma difference between the tap and the centre, so
 * flat areas are smoothed while step edges stay sharp. The range term is a
 * precomputed 256-entry LUT over |ΔI|; the window radius is round(σs), capped
 * at 5 to bound cost.
 *
 * @param params.sigmaSpatial spatial σs 1..10 (default 2)
 * @param params.sigmaRange   range σr 10..100 (default 30)
 * @param ctx progress/cancel hooks
 * @param border window sampling policy (default clamp)
 * @complexity O(W·H·(2r+1)²), r = min(5, round(σs))
 */
export function bilateralFilter(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
  border: BorderMode = 'clamp',
): ImageBuffer {
  const sigmaSpatial = Math.min(10, Math.max(1, params.sigmaSpatial ?? 2));
  const sigmaRange = Math.min(100, Math.max(10, params.sigmaRange ?? 30));
  const radius = Math.min(BILATERAL_MAX_RADIUS, Math.max(1, Math.round(sigmaSpatial)));
  const window = 2 * radius + 1;
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);

  // Spatial weights depend only on the tap offset → precompute once.
  const spatial = new Float32Array(window * window);
  const twoSigmaS2 = 2 * sigmaSpatial * sigmaSpatial;
  for (let ky = 0; ky < window; ky += 1) {
    for (let kx = 0; kx < window; kx += 1) {
      const dx = kx - radius;
      const dy = ky - radius;
      spatial[ky * window + kx] = Math.exp(-(dx * dx + dy * dy) / twoSigmaS2);
    }
  }
  // Range weights depend only on the luma difference → 256-entry LUT.
  const rangeLut = new Float32Array(256);
  const twoSigmaR2 = 2 * sigmaRange * sigmaRange;
  for (let d = 0; d < 256; d += 1) rangeLut[d] = Math.exp(-(d * d) / twoSigmaR2);

  // One luma sample per pixel: the range term compares luma (3× cheaper than
  // three per-channel differences, visually equivalent for denoising).
  const lumaPlane = new Float32Array(width * height);
  for (let p = 0, i = 0; p < data.length; p += 4, i += 1) {
    lumaPlane[i] = luma(data[p], data[p + 1], data[p + 2]);
  }

  for (let y = 0; y < height; y += 1) {
    tick(ctx, y, height);
    for (let x = 0; x < width; x += 1) {
      const o = pixelOffset(x, y, width);
      const centreLuma = lumaPlane[(o / 4) | 0];
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumW = 0;
      for (let ky = 0; ky < window; ky += 1) {
        const sy = y + ky - radius;
        for (let kx = 0; kx < window; kx += 1) {
          const index = sampleIndex(x + kx - radius, sy, width, height, border);
          if (index < 0) continue;
          const delta = Math.abs(lumaPlane[(index / 4) | 0] - centreLuma) | 0;
          const w = spatial[ky * window + kx] * rangeLut[delta];
          sumR += data[index] * w;
          sumG += data[index + 1] * w;
          sumB += data[index + 2] * w;
          sumW += w;
        }
      }
      const inv = sumW > 0 ? 1 / sumW : 0;
      out[o] = clampByte(sumR * inv);
      out[o + 1] = clampByte(sumG * inv);
      out[o + 2] = clampByte(sumB * inv);
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}
