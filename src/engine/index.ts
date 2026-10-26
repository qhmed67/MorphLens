/**
 * index.ts — the engine facade. UI code imports only from here (or from
 * `bridge/skia`); screens never touch pixels or algorithm internals directly.
 *
 * `runOperation` merges/clamps params to the registry definition, so a slider
 * can never feed an out-of-range value into an algorithm.
 */
import { OPERATION_BY_ID, OPERATIONS } from './registry';
import type { ImageBuffer, OperationDef, RunCtx } from './types';

export * from './types';
export * from './buffer';
export * from './color/spaces';
export * from './color/adjust';
export * from './color/effects';
export * from './spatial/kernels';
export * from './spatial/convolve';
export * from './spatial/edges';
export * from './enhance/histogram';
export * from './enhance/stretch';
export * from './enhance/sharpen';
export * from './enhance/clahe';
export * from './enhance/lut';
export * from './color/balance';
export * from './frequency/fft';
export * from './frequency/filters';
export * from './frequency/mask';
export * from './noise/generate';
export * from './noise/denoise';
export * from './noise/metrics';
export * from './creative/filters';
export { OPERATIONS, OPERATION_BY_ID } from './registry';

/** All registered operations (stable order). */
export function listOperations(): readonly OperationDef[] {
  return OPERATIONS;
}

/** Look up one operation, throwing a descriptive error when unknown. */
export function getOperation(id: string): OperationDef {
  const operation = OPERATION_BY_ID[id];
  if (!operation) throw new Error(`Unknown engine operation: ${id}`);
  return operation;
}

/** Merge caller params with registry defaults and clamp them to their ranges. */
export function mergeParams(
  definitions: readonly OperationDef['params'][number][],
  params: Record<string, number> = {},
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const def of definitions) {
    const value = params[def.key];
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : def.default;
    merged[def.key] = Math.min(def.max, Math.max(def.min, numeric));
  }
  return merged;
}

/**
 * Run one registered operation on an image.
 *
 * @param id operation id from `listOperations()`
 * @param params partial numeric params; missing values use defaults
 * @param ctx optional progress/cancel hooks
 * @complexity depends on the operation (see registry `cost`)
 */
export function runOperation(
  id: string,
  src: ImageBuffer,
  params: Record<string, number> = {},
  ctx?: RunCtx,
): ImageBuffer {
  const operation = getOperation(id);
  return operation.run(src, mergeParams(operation.params, params), ctx);
}
