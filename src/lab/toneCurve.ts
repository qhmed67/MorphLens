/**
 * toneCurve.ts — the small, pure maths behind the Histogram Surgery curve.
 *
 * The editor exposes five control points at input intensities 0, 64, 128, 192
 * and 255. The engine only needs a 256-entry lookup table, so this module
 * converts the points into that table with straight-line segments. Keeping it
 * pure makes the mapping testable and lets the UI recompute it on the JS
 * thread without touching pixels.
 */

/** Input positions of the five control points. */
export const TONE_X = [0, 64, 128, 192, 255] as const;

/** Five control outputs at the fixed inputs above. */
export type TonePoints = readonly [number, number, number, number, number];

/** Neutral curve: every input returns itself. */
export const TONE_IDENTITY: TonePoints = [0, 64, 128, 192, 255];

/** Gentle S-curve: deeper shadows, brighter highlights, unchanged mid-grey. */
export const TONE_SOFT: TonePoints = [0, 52, 128, 204, 255];

/** Stronger S-curve for flat photos. */
export const TONE_CONTRAST: TonePoints = [0, 36, 128, 220, 255];

/** Lifted shadows for a washed, airy look. */
export const TONE_LIFT: TonePoints = [24, 82, 140, 202, 255];

export const TONE_PRESETS: readonly { id: string; label: string; points: TonePoints }[] = [
  { id: 'linear', label: 'Linear', points: TONE_IDENTITY },
  { id: 'soft', label: 'Soft S', points: TONE_SOFT },
  { id: 'contrast', label: 'Contrast', points: TONE_CONTRAST },
  { id: 'lift', label: 'Lift', points: TONE_LIFT },
];

/** Clamp a control point to the byte range and round it for display/engine. */
export function clampTonePoint(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

/**
 * Convert the five control points into a 256-entry LUT.
 *
 * @throws if the curve does not have exactly five control points
 * @complexity O(256)
 */
export function buildToneLut(points: readonly number[]): Uint8Array {
  if (points.length !== TONE_X.length) {
    throw new Error(`A tone curve needs exactly ${TONE_X.length} control points`);
  }
  const safe = points.map(clampTonePoint);
  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    const segment = TONE_X.findIndex((x) => value <= x);
    const index = segment <= 0 ? 0 : Math.min(TONE_X.length - 2, segment - 1);
    const x0 = TONE_X[index];
    const x1 = TONE_X[index + 1];
    const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
    const clamped = Math.min(1, Math.max(0, t));
    lut[value] = Math.round(safe[index] + (safe[index + 1] - safe[index]) * clamped);
  }
  return lut;
}

/** Sample the piecewise-linear curve at one input value (for labels/previews). */
export function toneAt(points: readonly number[], value: number): number {
  if (points.length !== TONE_X.length) {
    throw new Error(`A tone curve needs exactly ${TONE_X.length} control points`);
  }
  const v = Math.min(255, Math.max(0, value));
  const segment = TONE_X.findIndex((x) => v <= x);
  const index = segment <= 0 ? 0 : Math.min(TONE_X.length - 2, segment - 1);
  const x0 = TONE_X[index];
  const x1 = TONE_X[index + 1];
  const t = x1 === x0 ? 0 : (v - x0) / (x1 - x0);
  return clampTonePoint(points[index] + (points[index + 1] - points[index]) * t);
}
