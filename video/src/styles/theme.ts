/**
 * theme.ts — the modern showreel's design tokens.
 *
 * **Light, not dark.** The owner is explicit: no dark videos. So the page is
 * the same warm paper the five reference reels use (#EFEDE4), the ink is the
 * app's ink, and colour means something instead of branding: green = good,
 * red = bad.
 * What makes this reel "modern" is the *motion* — the cuts, the effects, the
 * numbers that move — not a dark background.
 */
export const dark = {
  bg: '#EFEDE4',
  bgLift: '#F7F5F0',
  panel: 'rgba(255,255,255,0.88)',
  panelSolid: '#FFFFFF',
  line: 'rgba(20,20,18,0.10)',
  lineSoft: 'rgba(20,20,18,0.06)',
  text: '#141412',
  dim: 'rgba(20,20,18,0.62)',
  faint: 'rgba(20,20,18,0.38)',
  /** Something worked / improved. */
  good: '#0F7A46',
  goodSoft: 'rgba(15,122,70,0.12)',
  goodGlow: '0 0 20px rgba(15,122,70,0.28)',
  /** Something is broken / noisy. */
  bad: '#B4342B',
  badSoft: 'rgba(180,52,43,0.11)',
  badGlow: '0 0 20px rgba(180,52,43,0.26)',
  /**
   * @deprecated The brand orange is gone — black, green (good) and red (bad).
   * Kept as the ink so old markup simply reads as black.
   */
  accent: '#141412',
  accentSoft: 'rgba(20,20,18,0.08)',
  glow: 'none',
} as const;

export const darkType = {
  display: { fontSize: 88, lineHeight: '96px' },
  title: { fontSize: 62, lineHeight: '74px' },
  headline: { fontSize: 40, lineHeight: '52px' },
  body: { fontSize: 27, lineHeight: '38px' },
  mono: { fontSize: 26, lineHeight: '32px' },
} as const;

export const darkFont = {
  display: 'Rubik',
  title: 'Rubik',
  headline: 'Rubik',
  body: 'Rubik',
  mono: 'JetBrains Mono',
  label: 'Space Grotesk',
} as const;

export const darkSpace = { 1: 8, 2: 14, 3: 20, 4: 28, 5: 40, 6: 56, 8: 80 } as const;
