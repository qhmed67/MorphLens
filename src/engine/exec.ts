/**
 * exec.ts — chunked execution policy for the engine facade.
 *
 * Theory: a synchronous 512² median on Hermes can occupy the JS thread for
 * hundreds of milliseconds, which stalls gesture handling and React commits.
 * The policy here keeps every algorithm untouched and instead *slices the
 * image*: an operation whose neighbourhood radius r (its registry `halo`) is
 * known can run band by band over rows [y0, y1), provided each band's input
 * slice extends r rows beyond the band on both sides. Every output row then
 * reads only rows inside the slice, so band results are **bit-identical** to
 * a single whole-image run (the slice's own edge outputs are discarded).
 *
 * Global operations (undefined `halo`: histograms, CLAHE, FFT masks,
 * hysteresis connectivity, seeded-noise scan order) cannot be sliced; they
 * run in one piece, but the executor still yields a frame before and after
 * so the UI can paint around them.
 *
 * This file stays pure TypeScript (no React/Skia): the frame yield is either
 * injected (`yieldFn`, used by tests) or a guarded rAF/timeout fallback.
 * `src/core/worker.ts` owns the platform-side scheduler for app code.
 *
 * Complexity: identical to the underlying operation plus O(W·H) copying.
 */
import { getOperation, mergeParams } from './index';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from './types';

/** Rows computed per synchronous chunk when the op declares a halo. */
const DEFAULT_BAND_ROWS = 32;

export type ExecuteOptions = {
  /** Rows per band (default 32). Small values keep the UI most responsive. */
  bandRows?: number;
  /** Frame yield between bands; defaults to rAF/timeout. Tests inject a no-op. */
  yieldFn?: () => Promise<void>;
  /** Progress in 0..1 across the whole image. */
  onProgress?: (progress: number) => void;
  /** Return true to abort; the returned promise rejects with EngineCancelledError. */
  shouldCancel?: () => boolean;
};

/** Engine-internal fallback yield: rAF when present, else a macrotask. */
async function defaultYield(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** Copy rows [y0, y1) of `from` into `to` starting at row `toY0`. */
function copyRows(to: ImageBuffer, from: ImageBuffer, y0: number, y1: number, toY0: number): void {
  const rowBytes = from.width * 4;
  to.data.set(
    from.data.subarray(y0 * rowBytes, y1 * rowBytes),
    toY0 * rowBytes,
  );
}

/** Extract rows [y0−halo, y1+halo) clamped to the image, as a standalone buffer. */
function sliceBand(src: ImageBuffer, y0: number, y1: number, halo: number): ImageBuffer {
  const top = Math.max(0, y0 - halo);
  const bottom = Math.min(src.height, y1 + halo);
  const rowBytes = src.width * 4;
  const data = new Uint8ClampedArray((bottom - top) * rowBytes);
  data.set(src.data.subarray(top * rowBytes, bottom * rowBytes));
  return { width: src.width, height: bottom - top, data };
}

/**
 * Run one registered operation without freezing the JS thread.
 *
 * Operations that declare a `halo` are streamed in row bands (bit-identical
 * to `runOperation`); global operations run whole after a frame yield.
 *
 * @param id operation id from `listOperations()`
 * @param src input image (never mutated)
 * @param params partial numeric params; missing values use registry defaults
 * @param options band size, yield scheduler, progress and cancel hooks
 * @complexity same as `runOperation` plus O(W·H) copying
 */
export async function runOperationAsync(
  id: string,
  src: ImageBuffer,
  params: Record<string, number> = {},
  options: ExecuteOptions = {},
): Promise<ImageBuffer> {
  const operation = getOperation(id);
  const merged = mergeParams(operation.params, params);
  const yieldFn = options.yieldFn ?? defaultYield;
  const bandRows = Math.max(1, Math.floor(options.bandRows ?? DEFAULT_BAND_ROWS));
  const ctx: RunCtx = {
    onProgress: options.onProgress,
    shouldCancel: options.shouldCancel,
  };
  const halo = operation.halo?.(merged);

  // Give the UI one frame before any work starts.
  await yieldFn();
  if (ctx.shouldCancel?.()) throw new EngineCancelledError();

  if (halo === undefined || src.height <= halo) {
    // Global (or tiny) image: one whole run between two yields.
    const result = operation.run(src, merged, ctx);
    ctx.onProgress?.(1);
    await yieldFn();
    return result;
  }

  // Banded streaming: each band slice carries `halo` context rows, so every
  // kept output row sees exactly the neighbourhood a whole-image run would.
  const out: ImageBuffer = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length) };
  const bandCount = Math.ceil(src.height / bandRows);
  let bandIndex = 0;
  for (let y0 = 0; y0 < src.height; y0 += bandRows, bandIndex += 1) {
    if (ctx.shouldCancel?.()) throw new EngineCancelledError();
    const y1 = Math.min(src.height, y0 + bandRows);
    const slice = sliceBand(src, y0, y1, halo);
    const top = Math.max(0, y0 - halo);
    const sliceTop = y0 - top; // where the band starts inside its slice
    // Map the band's internal progress onto the global 0..1 range.
    const band = operation.run(slice, merged, {
      onProgress: (value) => ctx.onProgress?.((bandIndex + value) / bandCount),
      shouldCancel: ctx.shouldCancel,
    });
    // Copy the band's interior rows (context rows in the slice are discarded;
    // the first/last band clamps to the image like the whole-image run).
    copyRows(out, band, sliceTop, sliceTop + (y1 - y0), y0);
    ctx.onProgress?.((bandIndex + 1) / bandCount);
    await yieldFn();
  }
  return out;
}
