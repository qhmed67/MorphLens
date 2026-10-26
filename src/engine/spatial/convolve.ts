/**
 * convolve.ts — generic 2-D convolution and a separable fast path.
 *
 * Theory: (f * w)(x,y) = Σ_s Σ_t w(s,t)·f(x+s, y+t). Convolution is the basic
 * spatial-filtering primitive: smoothing (mean/Gaussian), sharpening and
 * derivatives (Sobel/Laplacian) are all kernels. A separable kernel
 * w(s,t) = u(s)·v(t) reduces cost from O(k²) to O(2k) per pixel.
 *
 * Complexity: 2-D O(W·H·k²); separable O(W·H·k).
 * Border modes: clamp (replicate), reflect (mirror, no edge repeat), zero.
 * Reference: Gonzalez & Woods, Digital Image Processing — "Spatial Filtering".
 */
import { clampByte, pixelOffset, sampleIndex } from '../buffer';
import { EngineCancelledError, type BorderMode, type ImageBuffer, type Kernel, type RunCtx } from '../types';

/** Progress is reported every N rows to keep callback overhead negligible. */
const PROGRESS_ROWS = 16;

/** Validate a kernel before entering the hot loop. */
function assertKernel(kernel: Kernel): void {
  if (kernel.size < 1 || kernel.size % 2 === 0) {
    throw new Error(`Invalid kernel size ${kernel.size}`);
  }
  if (kernel.weights.length !== kernel.size * kernel.size) {
    throw new Error('Kernel weight count does not match size');
  }
}

/**
 * Convolve an image with a square kernel.
 *
 * @param border clamp | reflect | zero
 * @complexity O(W·H·k²)
 */
export function convolve(
  src: ImageBuffer,
  kernel: Kernel,
  border: BorderMode = 'clamp',
  ctx?: RunCtx,
): ImageBuffer {
  assertKernel(kernel);
  const { width, height, data } = src;
  const k = kernel.size;
  const half = (k - 1) / 2;
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let ky = 0; ky < k; ky += 1) {
        const sy = y + ky - half;
        for (let kx = 0; kx < k; kx += 1) {
          const weight = kernel.weights[ky * k + kx];
          if (weight === 0) continue;
          const index = sampleIndex(x + kx - half, sy, width, height, border);
          if (index < 0) continue;
          sumR += data[index] * weight;
          sumG += data[index + 1] * weight;
          sumB += data[index + 2] * weight;
        }
      }
      const o = pixelOffset(x, y, width);
      out[o] = clampByte(sumR);
      out[o + 1] = clampByte(sumG);
      out[o + 2] = clampByte(sumB);
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/**
 * Separable convolution: horizontal pass then vertical pass, both with 1-D
 * kernels. The intermediate is float so 8-bit quantisation happens only once.
 *
 * @complexity O(W·H·k)
 */
export function separableConvolve(
  src: ImageBuffer,
  horizontal: Kernel,
  vertical: Kernel,
  border: BorderMode = 'clamp',
  ctx?: RunCtx,
): ImageBuffer {
  // Both passes are 1-D; a square 2-D kernel has size² weights and is rejected.
  for (const kernel of [horizontal, vertical]) {
    if (kernel.size < 1 || kernel.size % 2 === 0 || kernel.weights.length !== kernel.size) {
      throw new Error('separableConvolve expects 1-D kernels with odd size');
    }
  }
  const { width, height, data } = src;
  const kh = horizontal.size;
  const kv = vertical.size;
  const halfH = (kh - 1) / 2;
  const halfV = (kv - 1) / 2;
  const tmp = new Float32Array(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.((y / height) * 0.5);
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let kx = 0; kx < kh; kx += 1) {
        const index = sampleIndex(x + kx - halfH, y, width, height, border);
        if (index < 0) continue;
        const w = horizontal.weights[kx];
        r += data[index] * w;
        g += data[index + 1] * w;
        b += data[index + 2] * w;
      }
      const o = (y * width + x) * 3;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
    }
  }

  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.(0.5 + (y / height) * 0.5);
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = 0; ky < kv; ky += 1) {
        const sy = y + ky - halfV;
        const sx = Math.min(width - 1, Math.max(0, x));
        // Vertical pass reads the already horizontally-filtered row.
        const index = sampleIndex(sx, sy, width, height, border);
        if (index < 0) continue;
        const rowOffset = (Math.floor(index / (width * 4)) * width + sx) * 3;
        const w = vertical.weights[ky];
        r += tmp[rowOffset] * w;
        g += tmp[rowOffset + 1] * w;
        b += tmp[rowOffset + 2] * w;
      }
      const o = pixelOffset(x, y, width);
      out[o] = clampByte(r);
      out[o + 1] = clampByte(g);
      out[o + 2] = clampByte(b);
      out[o + 3] = data[o + 3];
    }
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/** Convenience: 1-D kernel with all weight in the centre (identity pass). */
export function identityKernel1D(): Kernel {
  return { size: 1, weights: [1] };
}
