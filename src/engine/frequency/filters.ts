/**
 * filters.ts — frequency-domain image filters (ideal / Gaussian / Butterworth
 * low- and high-pass, band pass / reject) and the magnitude-spectrum display.
 *
 * Theory: convolution in space equals multiplication in frequency. A filter
 * multiplies the DFT of the image by a real, symmetric mask H(D), where D is
 * the radial frequency in cycles per pixel (0.5 = Nyquist along the axes):
 *
 *   ideal      H = [D ≤ D0]
 *   gaussian   H = exp(−D² / (2·D0²))
 *   butterworth H = 1 / (1 + (D/D0)^2n)
 *   high-pass  H_hp = 1 − H_lp        (complement of the low-pass mask)
 *   band-pass  H = exp(−D²/(2·Dhi²)) − exp(−D²/(2·Dlo²)),  Dlo/Dhi = D0 ∓ W/2
 *   band-reject H_br = 1 − H_bp
 *
 * The ideal filter's hard cutoff rings (Gibbs phenomenon); Butterworth order
 * n trades sharpness against ringing; the Gaussian never rings. The image is
 * zero-padded to the next power of two (see fft.ts) and filtered per RGB
 * channel; results are cropped back to the original size.
 *
 * `spectrumImage` renders log(1+|F|) with DC shifted to the centre — the
 * classic "frequency domain" picture shown on Lab screen 4.
 *
 * Complexity: O(W·H·log(W·H)) per channel (FFT + mask + inverse FFT).
 * Reference: Gonzalez & Woods, "Frequency Domain Filtering"; Oppenheim &
 * Schafer, "Discrete-Time Signal Processing".
 */
import { clampByte } from '../buffer';
import { fft2d, fftShift, nextPow2 } from './fft';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from '../types';

/** Radial frequency plane in cycles/pixel: 0.5 = Nyquist along the axes. */
function distancePlane(w2: number, h2: number): Float64Array {
  const dist = new Float64Array(w2 * h2);
  for (let y = 0; y < h2; y += 1) {
    // Wrapped distance: rows above h/2 mirror below (DC lives at (0,0)).
    const dy = Math.min(y, h2 - y);
    for (let x = 0; x < w2; x += 1) {
      const dx = Math.min(x, w2 - x);
      dist[y * w2 + x] = Math.hypot(dx, dy) / w2;
    }
  }
  return dist;
}

/**
 * Shared pipeline: pad → FFT → multiply mask → inverse FFT → crop.
 *
 * The mask receives the radial frequency `D` in cycles per pixel (0 at DC,
 * 0.5 at Nyquist along the axes) and returns its gain there. Exported so the
 * Lab's draggable radial mask can reuse the exact same maths.
 */
export function applyFrequencyMask(
  src: ImageBuffer,
  ctx: RunCtx | undefined,
  mask: (d: number) => number,
): ImageBuffer {
  const { width, height, data } = src;
  const w2 = nextPow2(width);
  const h2 = nextPow2(height);
  const dist = distancePlane(w2, h2);
  const out = new Uint8ClampedArray(data.length);
  const re = new Float64Array(w2 * h2);
  const im = new Float64Array(w2 * h2);

  for (let channel = 0; channel < 3; channel += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    ctx?.onProgress?.(channel / 3);
    // Zero-padded channel plane.
    re.fill(0);
    im.fill(0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        re[y * w2 + x] = data[(y * width + x) * 4 + channel];
      }
    }
    fft2d(w2, h2, re, im);
    for (let i = 0; i < re.length; i += 1) {
      const h = mask(dist[i]);
      re[i] *= h;
      im[i] *= h;
    }
    fft2d(w2, h2, re, im, true);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        out[(y * width + x) * 4 + channel] = clampByte(re[y * w2 + x]);
      }
    }
  }
  // Alpha is untouched by frequency filtering.
  for (let p = 3; p < data.length; p += 4) out[p] = data[p];
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/** Clamp a cutoff slider into the supported (0, 0.5] band. */
function cutoffOf(params: Record<string, number>, fallback: number): number {
  return Math.min(0.5, Math.max(0.001, params.cutoff ?? fallback));
}

/** Ideal low-pass: pass everything at or below D0, kill the rest. */
export function idealLowPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const d0 = cutoffOf(params, 0.15);
  return applyFrequencyMask(src, ctx, (d) => (d <= d0 ? 1 : 0));
}

/** Ideal high-pass: the complement of the ideal low-pass (kills DC). */
export function idealHighPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const d0 = cutoffOf(params, 0.15);
  return applyFrequencyMask(src, ctx, (d) => (d <= d0 ? 0 : 1));
}

/** Gaussian low-pass: smooth, ringing-free blur in the frequency domain. */
export function gaussianLowPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const d0 = cutoffOf(params, 0.15);
  return applyFrequencyMask(src, ctx, (d) => Math.exp(-(d * d) / (2 * d0 * d0)));
}

/** Gaussian high-pass: 1 − gaussian low-pass. */
export function gaussianHighPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const d0 = cutoffOf(params, 0.15);
  return applyFrequencyMask(src, ctx, (d) => 1 - Math.exp(-(d * d) / (2 * d0 * d0)));
}

/** Butterworth low-pass of order n: flat passband, controllable roll-off. */
export function butterworthLowPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const d0 = cutoffOf(params, 0.15);
  const order = Math.min(8, Math.max(1, Math.round(params.order ?? 2)));
  return applyFrequencyMask(src, ctx, (d) => 1 / (1 + Math.pow(d / d0, 2 * order)));
}

/** Butterworth high-pass: 1 − butterworth low-pass. */
export function butterworthHighPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const d0 = cutoffOf(params, 0.15);
  const order = Math.min(8, Math.max(1, Math.round(params.order ?? 2)));
  return applyFrequencyMask(src, ctx, (d) => 1 - 1 / (1 + Math.pow(d / d0, 2 * order)));
}

/** Band-pass: difference of two Gaussian low-passes centred on `center`. */
export function bandPass(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const { lo, hi } = bandLimits(params);
  return applyFrequencyMask(src, ctx, (d) => Math.exp(-(d * d) / (2 * hi * hi)) - Math.exp(-(d * d) / (2 * lo * lo)));
}

/** Band-reject: 1 − band-pass (keeps DC, removes a frequency band). */
export function bandReject(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const { lo, hi } = bandLimits(params);
  return applyFrequencyMask(src, ctx, (d) => 1 - (Math.exp(-(d * d) / (2 * hi * hi)) - Math.exp(-(d * d) / (2 * lo * lo))));
}

/** Band edges around `center` with `width`; the inner edge never reaches 0. */
function bandLimits(params: Record<string, number>): { lo: number; hi: number } {
  const center = Math.min(0.5, Math.max(0.01, params.center ?? 0.2));
  const width = Math.min(0.5, Math.max(0.01, params.width ?? 0.1));
  const hi = center + width / 2;
  const lo = Math.max(0.001, center - width / 2);
  return { lo, hi };
}

/**
 * Log-magnitude spectrum with DC shifted to the centre (grayscale, padded to
 * the power-of-two canvas, so the output size may exceed the input size).
 *
 * @param params.gain brightness of faint bins 1..8 (default 1)
 * @param params.smooth 1 = average each bin with its 8 neighbours, which
 *   turns single-pixel salt into readable structure on small photos
 * @param params.gamma curve applied to the normalised magnitude (1 = linear,
 *   < 1 lifts the faint structure so the picture reads as a spectrum)
 * @param ctx progress/cancel hooks
 * @complexity O(W·H·log(W·H))
 */
export function spectrumImage(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const gain = Math.min(8, Math.max(1, params.gain ?? 1));
  const smooth = (params.smooth ?? 0) >= 0.5;
  const gamma = Math.min(3, Math.max(0.1, params.gamma ?? 1));
  const { width, height, data } = src;
  const w2 = nextPow2(width);
  const h2 = nextPow2(height);
  const re = new Float64Array(w2 * h2);
  const im = new Float64Array(w2 * h2);
  // Grayscale (Rec.709) plane, zero-padded.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      const grey = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
      re[y * w2 + x] = grey;
    }
  }
  if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
  fft2d(w2, h2, re, im);
  fftShift(w2, h2, re, im);
  // log(1+|F|) compresses the huge DC spike so the rest becomes visible.
  let mag = new Float64Array(w2 * h2);
  let maxMag = 0;
  for (let i = 0; i < mag.length; i += 1) {
    mag[i] = Math.log(1 + Math.hypot(re[i], im[i]) * gain);
    if (mag[i] > maxMag) maxMag = mag[i];
  }
  if (smooth) {
    // A 3×3 box average over the magnitude plane: isolated bins (sensor
    // noise) disappear and the real structure of the photo becomes readable.
    const averaged = new Float64Array(mag.length);
    for (let y = 0; y < h2; y += 1) {
      for (let x = 0; x < w2; x += 1) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h2) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w2) continue;
            sum += mag[yy * w2 + xx];
            count += 1;
          }
        }
        averaged[y * w2 + x] = sum / count;
      }
    }
    mag = averaged;
  }
  const out = new Uint8ClampedArray(w2 * h2 * 4);
  for (let i = 0; i < mag.length; i += 1) {
    // Normalise to 0..1 first, then apply the curve, so `gamma` behaves the
    // same way whatever the raw magnitudes are.
    const normalised = maxMag > 0 ? mag[i] / maxMag : 0;
    const value = clampByte(normalised ** gamma * 255);
    const o = i * 4;
    out[o] = value;
    out[o + 1] = value;
    out[o + 2] = value;
    out[o + 3] = 255;
  }
  ctx?.onProgress?.(1);
  return { width: w2, height: h2, data: out };
}
