/**
 * kernels.ts — convolution kernel factories and Lab/Creative presets.
 *
 * Theory: a kernel is a small weight matrix w(s,t) applied to a neighbourhood.
 * Lower-pass kernels sum to 1 (preserve brightness); derivative kernels sum to
 * 0 (constant regions produce zero); sharpening kernels sum to 1 with a
 * positive centre and negative ring.
 *
 * Reference: Gonzalez & Woods, Digital Image Processing — "Spatial Filtering".
 */
import type { Kernel } from '../types';

/** Build a square kernel, validating the odd size and weight count. */
export function createKernel(size: number, weights: readonly number[]): Kernel {
  if (!Number.isInteger(size) || size < 1 || size % 2 === 0) {
    throw new Error(`Kernel size must be a positive odd integer, got ${size}`);
  }
  if (weights.length !== size * size) {
    throw new Error(`Kernel expects ${size * size} weights, got ${weights.length}`);
  }
  return { size, weights };
}

/** Build a 1-D kernel (used by the separable fast path). */
export function createKernel1D(size: number, weights: readonly number[]): Kernel {
  if (!Number.isInteger(size) || size < 1 || size % 2 === 0) {
    throw new Error(`Kernel size must be a positive odd integer, got ${size}`);
  }
  if (weights.length !== size) {
    throw new Error(`1-D kernel expects ${size} weights, got ${weights.length}`);
  }
  return { size, weights };
}

/** Identity kernel of the given odd size. */
export function identityKernel(size = 3): Kernel {
  const weights = new Array<number>(size * size).fill(0);
  weights[Math.floor((size * size) / 2)] = 1;
  return createKernel(size, weights);
}

/** Box (mean) blur kernel: every weight = 1/k². */
export function boxKernel(size: number): Kernel {
  return createKernel(size, new Array<number>(size * size).fill(1 / (size * size)));
}

/** 1-D Gaussian weights, normalised. Radius defaults to ceil(3σ). */
export function gaussianKernel1D(sigma: number, size?: number): Kernel {
  const s = Math.max(0.1, sigma);
  const k = size ?? Math.max(3, 2 * Math.ceil(3 * s) + 1);
  const half = Math.floor(k / 2);
  const weights = new Array<number>(k);
  let sum = 0;
  for (let i = 0; i < k; i += 1) {
    const x = i - half;
    const w = Math.exp(-(x * x) / (2 * s * s));
    weights[i] = w;
    sum += w;
  }
  for (let i = 0; i < k; i += 1) weights[i] /= sum;
  return createKernel1D(k, weights);
}

/**
 * 3×3 Gaussian kernel, normalised.
 *
 * `gaussianKernel(sigma)` sizes itself to cover 3σ (7×7 for σ = 1), which is
 * right for a *separable* blur but wrong for the Lab's 3×3 kernel editor: a
 * 7×7 matrix silently turned the 3×3 convolution into an almost-zero kernel
 * and the preview went black. This factory always returns nine weights.
 *
 * @param sigma standard deviation (0.1 .. 5)
 */
export function gaussianKernel3x3(sigma: number): Kernel {
  const s = Math.max(0.1, sigma);
  const one = [-1, 0, 1].map((x) => Math.exp(-(x * x) / (2 * s * s)));
  const sum = one[0] + one[1] + one[2];
  const middle = one.map((value) => value / sum);
  const weights: number[] = [];
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) weights.push(middle[y] * middle[x]);
  }
  return createKernel(3, weights);
}

/** 2-D Gaussian kernel, normalised (outer product of the 1-D kernel). */
export function gaussianKernel(sigma: number): Kernel {
  const one = gaussianKernel1D(sigma);
  const k = one.size;
  const weights = new Array<number>(k * k);
  for (let y = 0; y < k; y += 1) {
    for (let x = 0; x < k; x += 1) {
      weights[y * k + x] = one.weights[x] * one.weights[y];
    }
  }
  return createKernel(k, weights);
}

/** Sobel derivative mask for one axis. */
export function sobelKernel(axis: 'x' | 'y'): Kernel {
  return axis === 'x'
    ? createKernel(3, [-1, 0, 1, -2, 0, 2, -1, 0, 1])
    : createKernel(3, [-1, -2, -1, 0, 0, 0, 1, 2, 1]);
}

/** Prewitt derivative mask for one axis. */
export function prewittKernel(axis: 'x' | 'y'): Kernel {
  return axis === 'x'
    ? createKernel(3, [-1, 0, 1, -1, 0, 1, -1, 0, 1])
    : createKernel(3, [-1, -1, -1, 0, 0, 0, 1, 1, 1]);
}

/** Laplacian mask: 4-neighbour or 8-neighbour variant. */
export function laplacianKernel(variant: '4' | '8' = '4'): Kernel {
  return variant === '4'
    ? createKernel(3, [0, 1, 0, 1, -4, 1, 0, 1, 0])
    : createKernel(3, [1, 1, 1, 1, -8, 1, 1, 1, 1]);
}

/**
 * Laplacian-of-Gaussian (Mexican hat), zero-mean by construction.
 * @param sigma 0.5..5
 */
export function logKernel(sigma: number): Kernel {
  const s = Math.max(0.3, sigma);
  const k = Math.max(3, 2 * Math.ceil(3 * s) + 1);
  const half = Math.floor(k / 2);
  const weights = new Array<number>(k * k);
  let mean = 0;
  for (let y = 0; y < k; y += 1) {
    for (let x = 0; x < k; x += 1) {
      const dx = x - half;
      const dy = y - half;
      const r2 = dx * dx + dy * dy;
      const value = (1 - r2 / (2 * s * s)) * Math.exp(-r2 / (2 * s * s));
      weights[y * k + x] = value;
      mean += value;
    }
  }
  // Enforce a zero DC response so flat regions map to zero, not to a constant.
  mean /= k * k;
  for (let i = 0; i < weights.length; i += 1) weights[i] -= mean;
  return createKernel(k, weights);
}

/** Directional emboss with zero sum (callers add a 128 mid-grey bias). */
export function embossKernel(): Kernel {
  return createKernel(3, [-2, -1, 0, -1, 0, 1, 0, 1, 2]);
}

/** Classic 3×3 sharpen kernel (sum = 1). */
export function sharpenKernel(): Kernel {
  return createKernel(3, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
}
