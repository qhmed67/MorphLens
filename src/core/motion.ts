/**
 * Motion presets — transcribed from `design.md` §3.1. Every spring, duration,
 * easing curve and stagger in the app must come from here (SKILL §1 rule 8).
 */
import { Easing } from 'react-native-reanimated';

export const spring = {
  snappy: { damping: 18, stiffness: 320, mass: 0.8 }, // press-in, toggles
  smooth: { damping: 22, stiffness: 180, mass: 1 }, // layout, container transform
  gooey: { damping: 10, stiffness: 140, mass: 0.9 }, // press-out, blobs, overshoot
  heavy: { damping: 26, stiffness: 120, mass: 1.4 }, // large surfaces, sheets full-screen
  sheet: { damping: 28, stiffness: 260, mass: 1 },
} as const;

export const duration = {
  instant: 90,
  fast: 160,
  base: 260,
  slow: 420,
  morph: 560,
  hero: 900,
} as const;

export const ease = {
  emphasized: Easing.bezier(0.2, 0.8, 0.2, 1), // entering / revealing
  accelerate: Easing.bezier(0.3, 0.0, 0.8, 0.15), // leaving
  standard: Easing.bezier(0.4, 0.0, 0.2, 1),
} as const;

export const stagger = { list: 40, chips: 28, hud: 60 } as const; // ms between siblings

/**
 * Lab-mode timings (PLAN §3 Lab screens). Spec-derived constants, kept here so
 * no screen hard-codes a duration (SKILL §1 rule 8): the kernel sweep is a
 * data-driven loop whose length the speed slider maps into this range, and the
 * denoise arena debounces control commits before re-running the engine.
 */
export const labMotion = {
  /** Full Convolution Explainer sweep at the slowest / fastest slider ends (ms). */
  sweep: { slow: 12000, fast: 3000 },
  /** Settle time after a slider commit before the engine re-runs (PLAN §3.2). */
  debounceMs: 150,
  /** How long one Trace stage holds before crossfading into the next (ms). */
  stageHold: 2600,
  /** Trace "Code" tab typewriter: one tick every N ms, N characters per tick. */
  codeCharMs: 18,
  codeCharsPerTick: 2,
} as const;
