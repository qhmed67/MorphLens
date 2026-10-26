/**
 * tokens.ts — the reel's design tokens, in the house style of the five
 * reference reels (see `docs/REEL_STYLE.md`).
 *
 * The palette was sampled from the references: a warm paper page, white cards,
 * near-black ink and a grey second line.
 *
 * **There is no brand colour.** The owner does not want orange. Colour is
 * only ever *meaning*:
 *   good (green)  — a result that improved, a value that was kept, the winner
 *   bad  (red)    — noise, an outlier, a value that was removed
 * everything else is black on paper.
 */

export const color = {
  /** The page. Never pure white. */
  paper: '#EFEDE4',
  paperDeep: '#E7E4D9',
  /** Cards. */
  card: '#FFFFFF',
  cardDim: 'rgba(255,255,255,0.72)',
  /** The near-black chapter card. */
  ink: '#141412',
  chapter: '#12140F',
  /** The grey second line. */
  sub: '#6E6C65',
  faint: 'rgba(20,20,18,0.38)',
  hairline: 'rgba(20,20,18,0.10)',
  hairlineStrong: 'rgba(20,20,18,0.18)',
  /** Something worked / improved / is the result to keep. */
  good: '#0F7A46',
  goodSoft: 'rgba(15,122,70,0.12)',
  goodLine: 'rgba(15,122,70,0.45)',
  /** Something is broken / noisy / gets thrown away. */
  bad: '#B4342B',
  badSoft: 'rgba(180,52,43,0.11)',
  badLine: 'rgba(180,52,43,0.42)',
  onAccent: '#FBFBF8',
  /** The same two meanings, lifted so they read on the dark chapter card. */
  goodOnDark: '#3FCF8E',
  badOnDark: '#FF8272',
  /**
   * @deprecated The brand orange is gone. Kept as an alias for the ink so any
   * markup that only meant "the emphasised bit" simply reads as black; switch
   * real meanings to `good` / `bad`.
   */
  accent: '#141412',
  accentSoft: 'rgba(20,20,18,0.08)',
} as const;

export const space = {
  0: 0,
  1: 6,
  2: 12,
  3: 18,
  4: 24,
  5: 32,
  6: 40,
  8: 56,
  10: 72,
  14: 96,
} as const;

export const radius = { xs: 12, sm: 18, md: 26, lg: 34, xl: 44, pill: 999 } as const;

/** The soft warm shadow the cards cast on the paper. */
export const shadow = {
  card: '0 30px 70px rgba(60,50,40,0.16)',
  cardFlat: '0 12px 30px rgba(60,50,40,0.10)',
  pill: '0 8px 20px rgba(60,50,40,0.14)',
} as const;

/** Type scale @1080 wide. */
export const type = {
  /** The Arabic headline. */
  display: { fontSize: 62, lineHeight: '76px' },
  title: { fontSize: 48, lineHeight: '60px' },
  headline: { fontSize: 34, lineHeight: '46px' },
  body: { fontSize: 27, lineHeight: '38px' },
  caption: { fontSize: 23, lineHeight: '32px' },
  mono: { fontSize: 26, lineHeight: '34px' },
} as const;

export const font = {
  /** Rubik carries the Arabic (and the Latin it needs). */
  display: 'Rubik',
  title: 'Rubik',
  headline: 'Rubik',
  body: 'Rubik',
  caption: 'Rubik',
  mono: 'JetBrains Mono',
  label: 'Space Grotesk',
} as const;

/** Platform-safe margins for a vertical reel. */
export const safe = { top: 150, bottom: 280, side: 72 } as const;

export const VIDEO = { width: 1080, height: 1920, fps: 30 } as const;
