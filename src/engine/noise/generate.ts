/**
 * generate.ts — synthetic noise models with a deterministic seeded PRNG.
 *
 * Theory: noise is modelled as a random process added to (or multiplied with)
 * the signal. Gaussian noise models sensor read noise; salt-and-pepper models
 * impulsive transmission errors; speckle is multiplicative (radar/ultrasound).
 *
 * Determinism: every function takes a seed and uses mulberry32, so identical
 * seeds produce identical bytes on every platform (needed for tests and the
 * Denoise Arena's before/after comparisons).
 *
 * Reference: Gonzalez & Woods, Digital Image Processing — "Noise Models".
 */
import { clampByte, cloneImageBuffer } from '../buffer';
import type { ImageBuffer } from '../types';

/** Small, fast, deterministic 32-bit PRNG (mulberry32). Returns [0,1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample via Box–Muller, using one uniform pair. */
function gaussianSample(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Additive white Gaussian noise, clipped to the byte range.
 * @param params.sigma standard deviation in 0..50 (default 16)
 * @param params.seed integer seed (default 1)
 * @complexity O(N)
 */
export function noiseGaussian(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const sigma = Math.max(0, params.sigma ?? 16);
  const rng = createRng(params.seed ?? 1);
  const out = cloneImageBuffer(src);
  for (let i = 0; i < out.data.length; i += 4) {
    // One sample per channel keeps the noise spatially white.
    out.data[i] = clampByte(out.data[i] + gaussianSample(rng) * sigma);
    out.data[i + 1] = clampByte(out.data[i + 1] + gaussianSample(rng) * sigma);
    out.data[i + 2] = clampByte(out.data[i + 2] + gaussianSample(rng) * sigma);
  }
  return out;
}

/**
 * Impulse noise: each pixel becomes 255 (salt) or 0 (pepper) with probability
 * p/2 each, otherwise it is untouched.
 * @param params.probability total impulse probability 0..0.2 (default 0.02)
 * @param params.seed integer seed (default 1)
 * @complexity O(N)
 */
export function noiseSaltPepper(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const probability = Math.min(1, Math.max(0, params.probability ?? 0.02));
  const rng = createRng(params.seed ?? 1);
  const out = cloneImageBuffer(src);
  for (let i = 0; i < out.data.length; i += 4) {
    const u = rng();
    if (u < probability) {
      const value = u < probability / 2 ? 255 : 0;
      out.data[i] = value;
      out.data[i + 1] = value;
      out.data[i + 2] = value;
    }
  }
  return out;
}

/**
 * Multiplicative speckle: out = in·(1 + N(0,σ)).
 * @param params.sigma relative strength 0..1 (default 0.1)
 * @param params.seed integer seed (default 1)
 * @complexity O(N)
 */
export function noiseSpeckle(src: ImageBuffer, params: Record<string, number>): ImageBuffer {
  const sigma = Math.max(0, params.sigma ?? 0.1);
  const rng = createRng(params.seed ?? 1);
  const out = cloneImageBuffer(src);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = clampByte(out.data[i] * (1 + gaussianSample(rng) * sigma));
    out.data[i + 1] = clampByte(out.data[i + 1] * (1 + gaussianSample(rng) * sigma));
    out.data[i + 2] = clampByte(out.data[i + 2] * (1 + gaussianSample(rng) * sigma));
  }
  return out;
}
