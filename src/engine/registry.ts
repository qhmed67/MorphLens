/**
 * registry.ts — the single catalogue of engine operations exposed to the UI.
 *
 * Every entry carries its parameters, explanation (for the Explain sheet) and
 * cost tier, so Lab screens and the facade stay generic. Metadata mirrors
 * architecture.md §18.2; all numeric params use the shared ParamDef shape.
 */
import type { ParamDef } from '@/core/types';
import { grayWorldWB, whitePatchWB } from './color/balance';
import { brightness, contrast, gamma, hueShift, saturation } from './color/adjust';
import {
  channelMixer,
  CHANNEL_MIXER_IDENTITY,
  duotone,
  grayscale,
  invert,
  posterize,
  sepia,
} from './color/effects';
import { clahe } from './enhance/clahe';
import { equalize } from './enhance/histogram';
import { laplacianSharpen, unsharpMask } from './enhance/sharpen';
import { autoLevels, contrastStretch } from './enhance/stretch';
import {
  bandPass,
  bandReject,
  butterworthHighPass,
  butterworthLowPass,
  gaussianHighPass,
  gaussianLowPass,
  idealHighPass,
  idealLowPass,
  spectrumImage,
} from './frequency/filters';
import { radialMask } from './frequency/mask';
import {
  adaptiveMedian,
  bilateralFilter,
  gaussianFilter,
  meanFilter,
  medianFilter,
} from './noise/denoise';
import { noiseGaussian, noiseSaltPepper, noiseSpeckle } from './noise/generate';
import { canny, prewittEdges, sobelEdges } from './spatial/edges';
import { convolve } from './spatial/convolve';
import { createKernel } from './spatial/kernels';
import {
  aurora,
  creativeDuotone,
  glitch,
  liquid,
  noir,
  vortex,
} from './creative/filters';
import type { ImageBuffer, OperationDef, RunCtx } from './types';

const p = (
  key: string,
  label: string,
  min: number,
  max: number,
  def: number,
  step?: number,
  unit?: string,
): ParamDef => ({ key, label, min, max, default: def, step, unit });

const mixerParams: ParamDef[] = CHANNEL_MIXER_IDENTITY.map((value, index) =>
  p(
    `m${Math.floor(index / 3)}${index % 3}`,
    `out${Math.floor(index / 3)} ← in${index % 3}`,
    -2,
    2,
    value,
    0.01,
  ),
);

/** Border dropdown encoded as a numeric param so the registry stays numeric. */
const BORDER_NAMES = ['clamp', 'reflect', 'zero'] as const;

/** Registry adapter: rebuild a 3×3 kernel from m00..m88 numeric params. */
function runConvolve(src: ImageBuffer, params: Record<string, number>, ctx?: RunCtx): ImageBuffer {
  const weights: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    weights.push(params[`m${Math.floor(i / 3)}${i % 3}`] ?? (i === 4 ? 1 : 0));
  }
  const index = Math.min(2, Math.max(0, Math.round(params.border ?? 0)));
  return convolve(src, createKernel(3, weights), BORDER_NAMES[index], ctx);
}

/**
 * Spatial identity kernel for the convolve defaults: the centre is 1, every
 * neighbour is 0, so opening the Lab shows the source untouched. Do not reuse
 * the channel-mixer identity here — that is a colour matrix, not a spatial
 * kernel, and starts the theatre with a diagonal ghost.
 */
const CONVOLVE_IDENTITY = [0, 0, 0, 0, 1, 0, 0, 0, 0] as const;

const convolveParams: ParamDef[] = CONVOLVE_IDENTITY.map((value, index) =>
  p(
    `m${Math.floor(index / 3)}${index % 3}`,
    `w${Math.floor(index / 3)}${index % 3}`,
    -8,
    8,
    value,
    0.1,
  ),
).concat([p('border', 'Border', 0, 2, 0, 1)]);

/** Ordered so the UI can group by category without sorting. */
export const OPERATIONS: readonly OperationDef[] = [
  {
    id: 'brightness',
    name: 'Brightness',
    category: 'color',
    params: [p('amount', 'Brightness', -100, 100, 0, 1)],
    run: brightness,
    explain: {
      summary: 'Adds a constant to every colour channel, lifting or lowering exposure.',
      formula: 'out = clamp(in + b)',
      whenToUse: 'Quick exposure correction before any other Lab operation.',
    },
    cost: 'light',
  },
  {
    id: 'contrast',
    name: 'Contrast',
    category: 'color',
    params: [p('amount', 'Contrast', 0, 3, 1, 0.01)],
    run: contrast,
    explain: {
      summary: 'Scales intensities around mid-grey, increasing or reducing separation.',
      formula: 'out = (in − 128)·c + 128',
      whenToUse: 'Flat photos that need more punch without changing hue.',
    },
    cost: 'light',
  },
  {
    id: 'gamma',
    name: 'Gamma',
    category: 'color',
    params: [p('amount', 'Gamma', 0.2, 5, 1, 0.01)],
    run: gamma,
    explain: {
      summary: 'Non-linear tone curve that brightens shadows or highlights.',
      formula: 'out = 255·(in/255)^(1/γ)',
      whenToUse: 'Recovering detail in dark or over-bright regions.',
    },
    cost: 'light',
  },
  {
    id: 'saturation',
    name: 'Saturation',
    category: 'color',
    params: [p('amount', 'Saturation', 0, 3, 1, 0.01)],
    run: saturation,
    explain: {
      summary: 'Pushes each pixel away from its luma; zero produces greyscale.',
      formula: 'out = luma + s·(in − luma)',
      whenToUse: 'Tasteful colour pop, or a calm base before edge detection.',
    },
    cost: 'light',
  },
  {
    id: 'hueShift',
    name: 'Hue shift',
    category: 'color',
    params: [p('degrees', 'Rotation', -180, 180, 0, 1, '°')],
    run: hueShift,
    explain: {
      summary: 'Rotates hue in HSV while preserving saturation and value.',
      formula: 'H′ = (H + θ) mod 360',
      whenToUse: 'Creative recolouring and demonstrating the hue wheel.',
    },
    cost: 'light',
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    category: 'color',
    params: [],
    run: grayscale,
    explain: {
      summary: 'Projects RGB onto Rec. 709 luma, the standard perceptual grey.',
      formula: 'Y = 0.2126R + 0.7152G + 0.0722B',
      whenToUse: 'Preparing for edges, morphology or a Noir look.',
    },
    cost: 'light',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    category: 'color',
    params: [p('amount', 'Strength', 0, 1, 1, 0.01)],
    run: sepia,
    explain: {
      summary: 'Applies the classic warm sepia matrix, blended by strength.',
      formula: 'out = M_sepia · in (blended)',
      whenToUse: 'Vintage styling and demonstrating channel mixing.',
    },
    cost: 'light',
  },
  {
    id: 'invert',
    name: 'Invert',
    category: 'color',
    params: [],
    run: invert,
    explain: {
      summary: 'Negates every colour channel.',
      formula: 'out = 255 − in',
      whenToUse: 'Negative imagery and as a building block for difference views.',
    },
    cost: 'light',
  },
  {
    id: 'channelMixer',
    name: 'Channel mixer',
    category: 'color',
    params: mixerParams,
    run: channelMixer,
    explain: {
      summary: 'Multiplies RGB by an arbitrary 3×3 matrix; identity by default.',
      formula: 'out = M · in, M ∈ R³ˣ³',
      whenToUse: 'Colour-space experiments, cross-processing, custom looks.',
    },
    cost: 'light',
  },
  {
    id: 'duotone',
    name: 'Duotone',
    category: 'color',
    params: [
      p('darkIndex', 'Shadow colour', 0, 6, 0, 1),
      p('lightIndex', 'Highlight colour', 0, 6, 6, 1),
    ],
    run: duotone,
    explain: {
      summary: 'Maps luma onto a two-colour ramp between a shadow and a light tone.',
      formula: 'out = dark + (light − dark)·Y/255',
      whenToUse: 'Graphic posters and two-ink print looks.',
    },
    cost: 'light',
  },
  {
    id: 'posterize',
    name: 'Posterize',
    category: 'color',
    params: [p('levels', 'Levels', 2, 32, 6, 1)],
    run: posterize,
    explain: {
      summary: 'Quantises each channel to a small number of evenly spaced levels.',
      formula: 'out = round(in/255·(L−1))/(L−1)·255',
      whenToUse: 'Poster art, banding demos, halftone preparation.',
    },
    cost: 'light',
  },
  {
    id: 'noiseGaussian',
    name: 'Gaussian noise',
    category: 'noise',
    params: [p('sigma', 'Strength σ', 0, 50, 16, 0.5), p('seed', 'Seed', 0, 9999, 1, 1)],
    // Seeded PRNG streams pixels in scan order: bands would desync the stream,
    // so no halo is declared (the executor runs noise ops whole — they are O(N)).
    run: noiseGaussian,
    explain: {
      summary: 'Adds independent white noise N(0, σ) to every channel — sensor read noise.',
      formula: "out = clamp(in + N(0, σ²))",
      whenToUse: 'Stressing the denoisers in the Denoise Arena.',
    },
    cost: 'light',
  },
  {
    id: 'noiseSaltPepper',
    name: 'Salt & pepper',
    category: 'noise',
    params: [p('probability', 'Impulse rate', 0, 0.2, 0.02, 0.005), p('seed', 'Seed', 0, 9999, 1, 1)],
    run: noiseSaltPepper,
    explain: {
      summary: 'Replaces pixels with pure black or white — transmission impulses.',
      formula: 'out = u < p/2 ? 255 : u < p ? 0 : in',
      whenToUse: 'Showing why median filtering beats averaging on impulses.',
    },
    cost: 'light',
  },
  {
    id: 'noiseSpeckle',
    name: 'Speckle',
    category: 'noise',
    params: [p('sigma', 'Strength σ', 0, 1, 0.1, 0.01), p('seed', 'Seed', 0, 9999, 1, 1)],
    run: noiseSpeckle,
    explain: {
      summary: 'Multiplicative noise out = in·(1 + N(0, σ)) — radar/ultrasound model.',
      formula: 'out = in · (1 + N(0, σ²))',
      whenToUse: 'Demonstrating signal-dependent noise.',
    },
    cost: 'light',
  },
  {
    id: 'meanFilter',
    name: 'Mean filter',
    category: 'noise',
    params: [p('k', 'Window', 3, 9, 3, 2, 'px')],
    run: meanFilter,
    halo: (params) => Math.ceil((Math.min(9, Math.max(3, Math.round(params.k ?? 3))) - 1) / 2),
    explain: {
      summary: 'Averages the k×k neighbourhood — the simplest smoothing filter.',
      formula: 'out = (1/k²)·Σ_W in',
      whenToUse: 'Baseline denoiser: fast, but blurs every edge it touches.',
    },
    cost: 'medium',
  },
  {
    id: 'gaussianFilter',
    name: 'Gaussian blur',
    category: 'noise',
    params: [p('sigma', 'Sigma σ', 0.5, 5, 1.4, 0.1, 'px')],
    run: gaussianFilter,
    halo: (params) =>
      Math.min(10, Math.max(1, Math.ceil(3 * Math.min(5, Math.max(0.5, params.sigma ?? 1.4))))),
    explain: {
      summary: 'Distance-weighted separable blur; the reference low-pass filter.',
      formula: 'out = Σ exp(−(s²+t²)/2σ²)·in / Σ exp(−(s²+t²)/2σ²)',
      whenToUse: 'Smooth pre-blur before gradients, or a soft-focus look.',
    },
    cost: 'medium',
  },
  {
    id: 'medianFilter',
    name: 'Median filter',
    category: 'noise',
    params: [p('k', 'Window', 3, 7, 3, 2, 'px')],
    run: medianFilter,
    halo: (params) => Math.ceil((Math.min(7, Math.max(3, Math.round(params.k ?? 3))) - 1) / 2),
    explain: {
      summary: 'Rank-order filter: takes the window median, deleting impulse noise.',
      formula: 'out = median_W{in}',
      whenToUse: 'Salt-and-pepper removal while keeping edges crisp.',
    },
    cost: 'heavy',
  },
  {
    id: 'adaptiveMedian',
    name: 'Adaptive median',
    category: 'noise',
    params: [p('kMax', 'Max window', 3, 11, 7, 2, 'px')],
    run: adaptiveMedian,
    halo: (params) => Math.ceil((Math.min(11, Math.max(3, Math.round(params.kMax ?? 7))) - 1) / 2),
    explain: {
      summary: 'Grows the window only around impulses, so flat areas never blur.',
      formula: 'k↑ until min < median < max; else fall back to the largest median',
      whenToUse: 'Heavy impulse noise where a plain median would over-smooth.',
    },
    cost: 'heavy',
  },
  {
    id: 'bilateralFilter',
    name: 'Bilateral',
    category: 'noise',
    params: [
      p('sigmaSpatial', 'Spatial σs', 1, 10, 2, 0.5, 'px'),
      p('sigmaRange', 'Range σr', 10, 100, 30, 5),
    ],
    run: bilateralFilter,
    halo: (params) =>
      Math.min(5, Math.max(1, Math.round(Math.min(10, Math.max(1, params.sigmaSpatial ?? 2))))),
    explain: {
      summary: 'Gaussian average weighted by intensity similarity — edge-preserving.',
      formula: 'out = Σ ws·wr·in / Σ ws·wr,  wr = exp(−ΔI²/2σr²)',
      whenToUse: 'Smoothing texture while keeping edges sharp.',
    },
    cost: 'heavy',
  },
  {
    id: 'contrastStretch',
    name: 'Contrast stretch',
    category: 'enhance',
    params: [p('mode', 'Range', 0, 1, 0, 1)],
    // min/max are global statistics: a band would stretch against its own
    // range, so this op must run whole (no halo).
    run: contrastStretch,
    explain: {
      summary: 'Rescales the observed luma (or per-channel) range onto 0..255.',
      formula: 'out = (in − min)/(max − min)·255',
      whenToUse: 'Washed-out photos that only use part of the histogram.',
    },
    cost: 'light',
  },
  {
    id: 'autoLevels',
    name: 'Auto levels',
    category: 'enhance',
    params: [],
    // Per-channel min/max are global statistics — no halo (runs whole).
    run: autoLevels,
    explain: {
      summary: 'Per-channel contrast stretch — the classic Levels → Auto.',
      formula: 'out_c = (in_c − min_c)/(max_c − min_c)·255',
      whenToUse: 'One-tap cast removal and contrast recovery.',
    },
    cost: 'light',
  },
  {
    id: 'equalize',
    name: 'Equalize',
    category: 'enhance',
    params: [p('mode', 'Range', 0, 1, 0, 1)],
    run: equalize,
    explain: {
      summary: 'Global histogram equalisation spreads intensities across 0..255.',
      formula: 'out = 255·CDF(in)',
      whenToUse: 'Maximal global contrast (over-amplifies noise — see CLAHE).',
    },
    cost: 'light',
  },
  {
    id: 'clahe',
    name: 'CLAHE',
    category: 'enhance',
    params: [p('tiles', 'Tiles', 4, 16, 8, 1), p('clip', 'Clip limit', 1, 8, 3, 0.5)],
    run: clahe,
    explain: {
      summary: 'Adaptive equalisation per tile with a clipped histogram limit.',
      formula: 'out = bilinear(lut_tiles(in)),  clip = limit·N_tile/256',
      whenToUse: 'Local contrast without the noise blow-up of global equalize.',
    },
    cost: 'heavy',
  },
  {
    id: 'unsharpMask',
    name: 'Unsharp mask',
    category: 'enhance',
    params: [p('amount', 'Amount', 0, 3, 1, 0.05), p('radius', 'Radius', 0.5, 5, 1.4, 0.1, 'px')],
    run: unsharpMask,
    halo: (params) =>
      Math.min(10, Math.max(1, Math.ceil(3 * Math.min(5, Math.max(0.5, params.radius ?? 1.4))))),
    explain: {
      summary: 'Adds back the high-frequency residual the Gaussian blur removed.',
      formula: 'out = in + amount·(in − blur(in))',
      whenToUse: 'Classic photographic sharpening with controllable halo.',
    },
    cost: 'heavy',
  },
  {
    id: 'laplacianSharpen',
    name: 'Laplacian sharpen',
    category: 'enhance',
    params: [p('amount', 'Amount', 0, 2, 1, 0.05)],
    run: laplacianSharpen,
    halo: () => 1,
    explain: {
      summary: 'Adds the second derivative (∇²) back to the image.',
      formula: 'out = in + c·∇²in,  ∇² ≈ 4-neighbour Laplacian',
      whenToUse: 'Comparing derivative-based sharpening against the unsharp mask.',
    },
    cost: 'medium',
  },
  {
    id: 'grayWorldWB',
    name: 'Gray-world WB',
    category: 'color',
    params: [p('strength', 'Strength', 0, 1, 1, 0.01)],
    // Channel means are global statistics — no halo (runs whole).
    run: grayWorldWB,
    explain: {
      summary: 'Scales channels so the scene average becomes neutral grey.',
      formula: 'gain_c = meanGray / mean(c)',
      whenToUse: 'Illuminant colour casts on scenes with mixed colours.',
    },
    cost: 'light',
  },
  {
    id: 'whitePatchWB',
    name: 'White-patch WB',
    category: 'color',
    params: [p('strength', 'Strength', 0, 1, 1, 0.01)],
    // Channel maxima are global statistics — no halo (runs whole).
    run: whitePatchWB,
    explain: {
      summary: 'Scales channels so the brightest sample becomes white.',
      formula: 'gain_c = 255 / max(c)',
      whenToUse: 'Scenes containing a bright dielectric highlight.',
    },
    cost: 'light',
  },
  {
    id: 'sobelEdges',
    name: 'Sobel edges',
    category: 'spatial',
    params: [p('threshold', 'Threshold', 0, 255, 0, 1)],
    run: sobelEdges,
    halo: () => 1,
    explain: {
      summary: 'Smoothed first derivative: gradient magnitude per pixel.',
      formula: 'mag = hypot(Gx, Gy)/(4√2),  Gx = Sobel_x * luma',
      whenToUse: 'Fast edge maps; the gradient feeding Canny.',
    },
    cost: 'medium',
  },
  {
    id: 'prewittEdges',
    name: 'Prewitt edges',
    category: 'spatial',
    params: [p('threshold', 'Threshold', 0, 255, 0, 1)],
    run: prewittEdges,
    halo: () => 1,
    explain: {
      summary: 'Unsmoothed 3×3 derivative — same magnitude normalisation as Sobel.',
      formula: 'mag = hypot(Gx, Gy)/(3√2),  Gx = Prewitt_x * luma',
      whenToUse: 'Comparing smoothing (Sobel) vs plain difference (Prewitt).',
    },
    cost: 'medium',
  },
  {
    id: 'canny',
    name: 'Canny edges',
    category: 'spatial',
    params: [
      p('sigma', 'Blur σ', 0.5, 3, 1.4, 0.1, 'px'),
      p('low', 'Low (rel.)', 0, 1, 0.1, 0.01),
      p('high', 'High (rel.)', 0, 1, 0.3, 0.01),
    ],
    // Hysteresis flood-fills across the whole image: bands would break the
    // connectivity, so Canny is global and runs in one piece.
    run: canny,
    explain: {
      summary: 'Blur → gradient → non-max suppression → double threshold + hysteresis.',
      formula: 'edges = hysteresis(nms(|∇(Gσ * in)|), low·max, high·max)',
      whenToUse: 'Clean one-pixel edge lines; the Lab stage visualiser.',
    },
    cost: 'heavy',
  },
  {
    id: 'convolve',
    name: 'Convolution 3×3',
    category: 'spatial',
    params: convolveParams,
    run: runConvolve,
    halo: () => 1,
    explain: {
      summary: 'General 3×3 weighted sum — every spatial filter in one op.',
      formula: 'out(x,y) = Σ_s Σ_t w(s,t)·in(x+s, y+t)',
      whenToUse: 'Kernel Theatre: edit the weights and watch the image follow.',
    },
    cost: 'medium',
  },
  {
    id: 'idealLowPass',
    name: 'Ideal low-pass',
    category: 'frequency',
    params: [p('cutoff', 'Cutoff D0', 0.001, 0.5, 0.15, 0.005)],
    run: idealLowPass,
    explain: {
      summary: 'Passes all frequencies below D0, kills the rest — hard cutoff.',
      formula: 'H(D) = D ≤ D0 ? 1 : 0',
      whenToUse: 'Seeing Gibbs ringing next to the softer filters.',
    },
    cost: 'heavy',
  },
  {
    id: 'idealHighPass',
    name: 'Ideal high-pass',
    category: 'frequency',
    params: [p('cutoff', 'Cutoff D0', 0.001, 0.5, 0.15, 0.005)],
    run: idealHighPass,
    explain: {
      summary: 'Complement of the ideal low-pass; removes DC and low frequencies.',
      formula: 'H(D) = D ≤ D0 ? 0 : 1',
      whenToUse: 'Harsh detail extraction and ringing demos.',
    },
    cost: 'heavy',
  },
  {
    id: 'gaussianLowPass',
    name: 'Gaussian low-pass',
    category: 'frequency',
    params: [p('cutoff', 'Cutoff D0', 0.001, 0.5, 0.15, 0.005)],
    run: gaussianLowPass,
    explain: {
      summary: 'Ringing-free frequency blur (the FFT twin of the spatial blur).',
      formula: 'H(D) = exp(−D²/2D0²)',
      whenToUse: 'Smoothing that never overshoots at edges.',
    },
    cost: 'heavy',
  },
  {
    id: 'gaussianHighPass',
    name: 'Gaussian high-pass',
    category: 'frequency',
    params: [p('cutoff', 'Cutoff D0', 0.001, 0.5, 0.15, 0.005)],
    run: gaussianHighPass,
    explain: {
      summary: 'Soft detail extraction with a Gaussian roll-off.',
      formula: 'H(D) = 1 − exp(−D²/2D0²)',
      whenToUse: 'Clean frequency-domain edges without ringing.',
    },
    cost: 'heavy',
  },
  {
    id: 'butterworthLowPass',
    name: 'Butterworth low-pass',
    category: 'frequency',
    params: [p('cutoff', 'Cutoff D0', 0.001, 0.5, 0.15, 0.005), p('order', 'Order n', 1, 8, 2, 1)],
    run: butterworthLowPass,
    explain: {
      summary: 'Flat passband with an order-tunable roll-off between ideal and Gaussian.',
      formula: 'H(D) = 1/(1 + (D/D0)^2n)',
      whenToUse: 'Dialling sharpness vs ringing on the Frequency Lab screen.',
    },
    cost: 'heavy',
  },
  {
    id: 'butterworthHighPass',
    name: 'Butterworth high-pass',
    category: 'frequency',
    params: [p('cutoff', 'Cutoff D0', 0.001, 0.5, 0.15, 0.005), p('order', 'Order n', 1, 8, 2, 1)],
    run: butterworthHighPass,
    explain: {
      summary: 'Order-tunable detail extraction between soft Gaussian and harsh ideal.',
      formula: 'H(D) = 1 − 1/(1 + (D/D0)^2n)',
      whenToUse: 'Comparing roll-off families at one cutoff.',
    },
    cost: 'heavy',
  },
  {
    id: 'bandPass',
    name: 'Band-pass',
    category: 'frequency',
    params: [p('center', 'Centre D0', 0.01, 0.5, 0.2, 0.005), p('width', 'Width', 0.01, 0.5, 0.1, 0.005)],
    run: bandPass,
    explain: {
      summary: 'Keeps a ring of frequencies: difference of two Gaussian low-passes.',
      formula: 'H = exp(−D²/2Dhi²) − exp(−D²/2Dlo²)',
      whenToUse: 'Isolating texture scales; ring patterns in the spectrum.',
    },
    cost: 'heavy',
  },
  {
    id: 'bandReject',
    name: 'Band-reject',
    category: 'frequency',
    params: [p('center', 'Centre D0', 0.01, 0.5, 0.2, 0.005), p('width', 'Width', 0.01, 0.5, 0.1, 0.005)],
    run: bandReject,
    explain: {
      summary: 'Removes a ring of frequencies — the complement of the band-pass.',
      formula: 'H = 1 − (exp(−D²/2Dhi²) − exp(−D²/2Dlo²))',
      whenToUse: 'Notching out periodic interference patterns.',
    },
    cost: 'heavy',
  },
  {
    id: 'radialMask',
    name: 'Radial mask',
    category: 'frequency',
    params: [
      p('mode', 'Mask', 0, 2, 0, 1),
      p('cutoff', 'Cutoff D0', 0.01, 0.5, 0.15, 0.005),
      p('band', 'Band width', 0.02, 0.5, 0.12, 0.005),
      p('softness', 'Soft edge', 0, 1, 0, 1),
    ],
    run: radialMask,
    explain: {
      summary: 'Draggable radial mask: a ring on the spectrum decides which frequencies survive.',
      formula: 'H(D) = low-pass / high-pass / band-pass around D0',
      whenToUse: 'Seeing blur = low frequencies and edges = high frequencies on your own photo.',
    },
    cost: 'heavy',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    category: 'creative',
    params: [p('strength', 'Strength', 0, 1, 0.6, 0.05), p('bands', 'Bands', 0, 1, 0.35, 0.05)],
    run: aurora,
    explain: {
      summary: 'Adds soft vertical light streaks that drift across the frame.',
      formula: 'out = in + max(0, sin(2π·bands·x + bend(y)))³ · strength',
      whenToUse: 'Adding a soft, luminous wash without touching the colours.',
    },
    cost: 'light',
  },
  {
    id: 'liquid',
    name: 'Liquid',
    category: 'creative',
    params: [p('strength', 'Strength', 0, 1, 0.5, 0.05), p('scale', 'Flow scale', 0, 1, 0.4, 0.05)],
    run: liquid,
    explain: {
      summary: 'Warps the image with a flow field — the pixels flow like water.',
      formula: 'sample(x + sin(y·s)·k, y + cos(x·s)·k)',
      whenToUse: 'Dreamy, liquid motion over any photo.',
    },
    cost: 'light',
  },
  {
    id: 'vortex',
    name: 'Vortex',
    category: 'creative',
    params: [p('strength', 'Strength', 0, 1, 0.5, 0.05)],
    run: vortex,
    explain: {
      summary: 'Swirls the image around its centre, strongest in the middle.',
      formula: 'θ(r) = (1 − r/rmax)² · strength · 3.2',
      whenToUse: 'A whirlpool pull towards the centre of the frame.',
    },
    cost: 'light',
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'creative',
    params: [p('strength', 'Strength', 0, 1, 0.5, 0.05), p('seed', 'Seed', 0, 9999, 3, 1)],
    run: glitch,
    explain: {
      summary: 'Horizontal blocks of the image jump sideways, like a broken signal.',
      formula: 'out(x, y) = in(x + shift(block), y)',
      whenToUse: 'Deliberate digital damage; the seed makes it repeatable.',
    },
    cost: 'light',
  },
  {
    id: 'duotoneMono',
    name: 'Duotone',
    category: 'creative',
    params: [
      p('strength', 'Strength', 0, 1, 1, 0.05),
      p('shadow', 'Shadow', 0, 255, 18, 1),
      p('light', 'Light', 0, 255, 242, 1),
    ],
    run: creativeDuotone,
    explain: {
      summary: 'Maps the luma onto a two-stop ramp — ink to paper.',
      formula: 'out = shadow + (light − shadow)·Y^0.92',
      whenToUse: 'Graphic, poster-like tone on a monochrome photo.',
    },
    cost: 'light',
  },
  {
    id: 'noir',
    name: 'Noir',
    category: 'creative',
    params: [
      p('strength', 'Strength', 0, 1, 1, 0.05),
      p('contrast', 'Contrast', 0, 1, 0.5, 0.05),
      p('vignette', 'Vignette', 0, 1, 0.6, 0.05),
    ],
    run: noir,
    explain: {
      summary: 'High-contrast greyscale with a dark vignette around the edges.',
      formula: 'out = (Y − 0.5)·contrast + 0.5, then ·(1 − vignette·r²)',
      whenToUse: 'Classic black-and-white film look.',
    },
    cost: 'light',
  },
  {
    id: 'spectrum',
    name: 'Spectrum',
    category: 'frequency',
    params: [p('gain', 'Gain', 1, 8, 1, 0.5)],
    run: spectrumImage,
    explain: {
      summary: 'Log-magnitude spectrum with DC at the centre (may pad to pow2 size).',
      formula: 'out = 255·log(1 + gain·|F|) / max',
      whenToUse: 'Seeing what each frequency filter will act on.',
    },
    cost: 'heavy',
  },
];

/** O(1) lookup by id. */
export const OPERATION_BY_ID: Readonly<Record<string, OperationDef>> = Object.fromEntries(
  OPERATIONS.map((operation) => [operation.id, operation]),
);
