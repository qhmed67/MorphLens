/**
 * mask.ts — a user-driven radial frequency mask (Lab screen 4).
 *
 * Theory: filtering in the frequency domain means multiplying the spectrum by
 * a gain H(D) that depends only on the radial frequency D (cycles per pixel,
 * 0 at the centre/DC and 0.5 at Nyquist along the axes). A low-pass mask keeps
 * the low frequencies (blurs), a high-pass mask keeps the high ones (edges),
 * and a band-pass keeps a ring of scales (texture at one size).
 *
 * The Lab screen draws those rings on the shifted spectrum, so a drag maps
 * one-to-one onto the cutoff: the ring radius in display pixels is
 * `cutoff · displayWidth`, because the spectrum's DC sits at the centre.
 *
 * Complexity: O(W·H·log(W·H)) per channel — the same pad → FFT → mask →
 * inverse FFT pipeline the fixed filters use (`applyFrequencyMask`).
 */
import type { ImageBuffer, RunCtx } from '../types';
import { applyFrequencyMask } from './filters';

/** Mask kinds exposed by the Lab screen. */
export const MASK_MODES = ['lowpass', 'highpass', 'bandpass'] as const;
export type MaskMode = (typeof MASK_MODES)[number];

/** Numeric mode used by the registry (the engine only speaks numbers). */
export function maskModeIndex(mode: MaskMode): number {
  return MASK_MODES.indexOf(mode);
}

/** Inverse of {@link maskModeIndex}; unknown numbers fall back to low-pass. */
export function maskModeFromIndex(index: number): MaskMode {
  const rounded = Math.round(index);
  return MASK_MODES[rounded] ?? 'lowpass';
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Apply a radial mask to an image.
 *
 * @param params.mode 0 = low-pass, 1 = high-pass, 2 = band-pass
 * @param params.cutoff cutoff radius D0 (0.001..0.5); the band's outer edge
 * @param params.band band-pass width (0.01..0.5)
 * @param params.softness 0 = hard (ideal) edge, 1 = Gaussian roll-off
 * @complexity O(W·H·log(W·H))
 */
export function radialMask(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const mode = Math.round(params.mode ?? 0);
  const cutoff = clampRange(params.cutoff ?? 0.15, 0.001, 0.5);
  const band = clampRange(params.band ?? 0.12, 0.01, 0.5);
  const soft = (params.softness ?? 0) >= 0.5;

  const lowPass = (d: number) =>
    soft ? Math.exp(-(d * d) / (2 * cutoff * cutoff)) : d <= cutoff ? 1 : 0;

  if (mode === 1) {
    return applyFrequencyMask(src, ctx, (d) => 1 - lowPass(d));
  }

  if (mode === 2) {
    // The cutoff is the *outer* edge of the band; the inner edge sits one
    // band-width below it, so dragging the visible ring moves the whole band.
    const hi = clampRange(cutoff, 0.01, 0.5);
    const lo = clampRange(cutoff - band, 0.001, hi - 0.001);
    return applyFrequencyMask(
      src,
      ctx,
      (d) => Math.exp(-(d * d) / (2 * hi * hi)) - Math.exp(-(d * d) / (2 * lo * lo)),
    );
  }

  return applyFrequencyMask(src, ctx, lowPass);
}
