/**
 * Design tokens — light monochrome system (owner directive 2026-10-20:
 * "white and black and gray"; the photo supplies all colour, the chrome never
 * competes). Transcribed in `design.md` §2 — components must never hard-code a
 * colour, radius, spacing or blur; import from here instead (SKILL §1 rule 8).
 *
 * Accent names are material words on purpose (ink/graphite/silver/mist/paper):
 * they describe what the tokens are, so a future theme swap cannot leave a
 * misleading `cyan` behind.
 */

export const color = {
  /** Page → card → inset → pressed, lightest first. */
  bg: { 0: '#F6F5F1', 1: '#FFFFFF', 2: '#EDECE7', 3: '#E1E0D9' },
  /** Translucent paper for chrome that floats over the photo. */
  glass: 'rgba(255,255,255,0.66)',
  glassStrong: 'rgba(255,255,255,0.86)',
  stroke: 'rgba(20,20,18,0.10)',
  strokeStrong: 'rgba(20,20,18,0.20)',
  /** Marks drawn over a photo (grid, seam, kernel window) — light, like a darkroom overlay. */
  photoStroke: 'rgba(255,255,255,0.22)',
  photoStrokeStrong: 'rgba(255,255,255,0.62)',
  /** Modal scrim; dark ink at low alpha keeps the photo readable beneath. */
  overlay: 'rgba(20,20,18,0.32)',
  text: {
    primary: '#141412',
    secondary: 'rgba(20,20,18,0.64)',
    tertiary: 'rgba(20,20,18,0.40)',
    onAccent: '#FBFAF7',
  },
  /** Monochrome accents. `ink` is the single "brand" action colour. */
  accent: {
    ink: '#141412',
    graphite: '#4E4D48',
    silver: '#8A8880',
    mist: '#C6C4BC',
    paper: '#FFFFFF',
  },
  /** Functional only — never decorative. */
  semantic: { success: '#3F7A5C', warning: '#8F6A2B', danger: '#A8473A' },
} as const;

export const gradient = {
  ink: ['#141412', '#6E6C65'],
  graphite: ['#4E4D48', '#A5A39B'],
  silver: ['#D8D6CE', '#F6F5F1'],
  paper: ['#FFFFFF', '#E9E7E0'],
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  14: 56,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const blur = { subtle: 20, glass: 40, heavy: 70 } as const;

export const z = { canvas: 0, hud: 10, chrome: 20, sheet: 30, overlay: 40, toast: 50 } as const;

export const font = {
  display: 'SpaceGrotesk_700Bold',
  title: 'SpaceGrotesk_600SemiBold',
  headline: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  caption: 'Inter_500Medium',
  mono: 'JetBrainsMono_500Medium',
} as const;

/** Type scale from design.md §2.1 (size / line-height). */
export const type = {
  display: { fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28 },
  headline: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  mono: { fontSize: 12, lineHeight: 16 },
} as const;
