/**
 * denoiseFilters.ts — the Denoise Arena's catalogue.
 *
 * The four restoration filters and the three noise models live here so the
 * arena screen, the Arabic guide and the tests all speak about the same
 * cards (and the screen file stays about the screen).
 */

/** The four arena cards (PLAN §3.2); params are the registry defaults. */
export const FILTERS = [
  { id: 'meanFilter', label: 'Mean', labelAr: 'المتوسط', params: { k: 3 } },
  { id: 'gaussianFilter', label: 'Gaussian', labelAr: 'جاوسيان', params: { sigma: 1.4 } },
  { id: 'medianFilter', label: 'Median', labelAr: 'الميديان', params: { k: 3 } },
  {
    id: 'bilateralFilter',
    label: 'Bilateral',
    labelAr: 'بايليترال',
    params: { sigmaSpatial: 2, sigmaRange: 30 },
  },
] as const;

export type NoiseType = 'gaussian' | 'saltPepper' | 'speckle';

/** Fixed seed: the amount slider scales one noise realisation, not a new one. */
export const NOISE_SEED = 7;

export const NOISE: Record<
  NoiseType,
  { id: string; label: string; params: (amount: number) => Record<string, number> }
> = {
  // The sigma is tuned for the arena's proxy: strong enough to see, light
  // enough that a good denoiser can still win the comparison.
  gaussian: { id: 'noiseGaussian', label: 'Gaussian', params: (a) => ({ sigma: a * 32 }) },
  saltPepper: {
    id: 'noiseSaltPepper',
    label: 'Salt & pepper',
    params: (a) => ({ probability: a * 0.12 }),
  },
  speckle: { id: 'noiseSpeckle', label: 'Speckle', params: (a) => ({ sigma: a }) },
};

export const NOISE_TYPES = Object.keys(NOISE) as NoiseType[];
