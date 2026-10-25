/**
 * Engine types — the contract between the pure-TypeScript image engine and
 * every caller (UI, tests, bridge). No React/Skia/Reanimated imports live here.
 */
import type { ParamDef } from '@/core/types';

/** How out-of-bounds kernel taps are sampled. */
export type BorderMode = 'clamp' | 'reflect' | 'zero';

/** RGBA image, row-major, 4 bytes per pixel. */
export type ImageBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/** A square convolution kernel (odd size). */
export type Kernel = {
  size: number;
  weights: readonly number[];
};

/** Cooperative context for long-running operations. */
export type RunCtx = {
  /** Reports progress in 0..1. Called at coarse row bands, never per pixel. */
  onProgress?: (progress: number) => void;
  /** Returning true aborts the operation (the engine throws EngineCancelledError). */
  shouldCancel?: () => boolean;
};

/** Image quality metrics. `psnr` is Infinity for identical images. */
export type Metrics = {
  mse: number;
  psnr: number;
  ssim: number;
};

/** Thrown when a caller cancels a long operation through RunCtx. */
export class EngineCancelledError extends Error {
  constructor() {
    super('Engine operation cancelled');
    this.name = 'EngineCancelledError';
  }
}

/** Registry metadata for one algorithm. */
export type OperationDef = {
  id: string;
  name: string;
  category: 'color' | 'noise' | 'enhance' | 'spatial' | 'frequency' | 'morphology' | 'creative';
  params: ParamDef[];
  run: (src: ImageBuffer, params: Record<string, number>, ctx?: RunCtx) => ImageBuffer;
  explain: { summary: string; formula: string; whenToUse: string };
  cost: 'light' | 'medium' | 'heavy';
  /**
   * Half-width of the neighbourhood each output pixel reads, derived from the
   * merged params. Undefined marks a *global* operation — one whose output at
   * (x, y) can depend on any pixel of the image (histograms, CLAHE tiles,
   * FFT masks, hysteresis connectivity, or a seeded RNG whose stream is tied
   * to scan order). The executor may only split operations with a defined
   * halo into row bands; it must run global ones in one piece.
   */
  halo?: (params: Record<string, number>) => number;
};
