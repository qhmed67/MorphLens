/**
 * Border-mode reference data for the convolution Lab (pure data, no React).
 *
 * Border handling only changes the outermost one-pixel ring, so the full
 * preview barely moves when the user switches modes. These examples zoom into
 * the top-left corner with a 3×3 average kernel: the two-digit numbers are
 * luma values, the shaded cells are the pixels the kernel reads from outside
 * the image, and the result is their average. The difference (59 / 76 / 30) is
 * deliberately large enough to see.
 */

export const BORDER_LABELS = ['Clamp', 'Reflect', 'Zero'] as const;

/**
 * True when the kernel reads only the centre pixel (the Identity kernel).
 *
 * Border mode decides what the kernel samples *outside* the photo, so with an
 * identity kernel no outside pixel is ever read and switching Clamp/Reflect/
 * Zero cannot change the image. The border UI uses this to say so instead of
 * leaving the user wondering why nothing moved.
 */
export function isIdentityKernel(weights: readonly number[]): boolean {
  if (weights.length !== 9) return false;
  return weights.every((weight, index) => (index === 4 ? weight === 1 : weight === 0));
}

/** Window centred on the top-left pixel: top row + left column are outside. */
export const BORDER_OUTSIDE = [
  [true, true, true],
  [true, false, false],
  [true, false, false],
] as const;

export type BorderInfo = {
  label: (typeof BORDER_LABELS)[number];
  arabic: string;
  english: string;
  /** Example 3×3 window values (luma). */
  values: readonly (readonly number[])[];
  /** Average output of the example window; shown in the card. */
  result: number;
};

export const BORDER_INFO: readonly BorderInfo[] = [
  {
    label: 'Clamp',
    arabic: 'يكرر آخر بكسل عند الحافة',
    english: 'repeat the edge pixel',
    values: [
      [40, 40, 80],
      [40, 40, 80],
      [60, 60, 90],
    ],
    result: 59,
  },
  {
    label: 'Reflect',
    arabic: 'يعكس البكسلات من الداخل',
    english: 'mirror inside pixels',
    values: [
      [90, 60, 90],
      [80, 40, 80],
      [90, 60, 90],
    ],
    result: 76,
  },
  {
    label: 'Zero',
    arabic: 'يعتبر الخارج أسود (0)',
    english: 'outside = 0 (black)',
    values: [
      [0, 0, 0],
      [0, 40, 80],
      [0, 60, 90],
    ],
    result: 30,
  },
];
