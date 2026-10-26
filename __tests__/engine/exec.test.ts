import { runOperationAsync } from '@/engine/exec';
import { listOperations, runOperation, type ImageBuffer } from '@/engine';
import { EngineCancelledError } from '@/engine';
import { ramp, verticalStep } from './fixtures';

/** Deterministic scheduler: resolves immediately, counts the yields. */
function makeYield(): { yieldFn: () => Promise<void>; getCalls: () => number } {
  let calls = 0;
  return {
    yieldFn: () => {
      calls += 1;
      return Promise.resolve();
    },
    getCalls: () => calls,
  };
}

/** Every halo-declaring operation the executor may stream. */
const BANDED_IDS = [
  'meanFilter',
  'gaussianFilter',
  'medianFilter',
  'adaptiveMedian',
  'bilateralFilter',
  'laplacianSharpen',
  'sobelEdges',
  'prewittEdges',
  'unsharpMask',
  'convolve',
];

const GLOBAL_IDS = [
  'clahe',
  'canny',
  'noiseGaussian',
  'grayWorldWB',
  'whitePatchWB',
  'contrastStretch',
  'autoLevels',
  'spectrum',
  'equalize',
];

function sameBytes(a: ImageBuffer, b: ImageBuffer): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i += 1) {
    if (a.data[i] !== b.data[i]) return false;
  }
  return true;
}

describe('runOperationAsync', () => {
  it.each(BANDED_IDS)('%s: banded result is bit-identical to the sync run', async (id) => {
    const src = ramp(48, 48);
    const sync = runOperation(id, src);
    const async = await runOperationAsync(id, src, {}, { bandRows: 8, yieldFn: () => Promise.resolve() });
    expect(sameBytes(async, sync)).toBe(true);
  });

  it.each(GLOBAL_IDS)('%s: global op runs whole and matches the sync run', async (id) => {
    const src = ramp(32, 32);
    const sync = runOperation(id, src);
    const async = await runOperationAsync(id, src, {}, { yieldFn: () => Promise.resolve() });
    expect(sameBytes(async, sync)).toBe(true);
  });

  it('stays exact on a step edge with 1-row bands (worst-case halo coverage)', async () => {
    const src = verticalStep(32, 32, 20, 220);
    const sync = runOperation('bilateralFilter', src, { sigmaSpatial: 2, sigmaRange: 30 });
    const async = await runOperationAsync(
      'bilateralFilter',
      src,
      { sigmaSpatial: 2, sigmaRange: 30 },
      { bandRows: 1, yieldFn: () => Promise.resolve() },
    );
    expect(sameBytes(async, sync)).toBe(true);
  });

  it('reports monotone progress ending at 1 and yields at least once per band', async () => {
    const seen: number[] = [];
    const { yieldFn, getCalls } = makeYield();
    await runOperationAsync('medianFilter', ramp(64, 64), {}, {
      bandRows: 16,
      yieldFn,
      onProgress: (value) => seen.push(value),
    });
    expect(seen.length).toBeGreaterThanOrEqual(4); // 64 rows / 16 per band
    expect(getCalls()).toBeGreaterThanOrEqual(5); // 1 before + ≥4 between
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('rejects with EngineCancelledError when cancelled', async () => {
    await expect(
      runOperationAsync('medianFilter', ramp(64, 64), {}, {
        shouldCancel: () => true,
        yieldFn: () => Promise.resolve(),
      }),
    ).rejects.toThrow(EngineCancelledError);
  });

  it('rejects on unknown operation ids', async () => {
    await expect(
      runOperationAsync('nope', ramp(8, 8), {}, { yieldFn: () => Promise.resolve() }),
    ).rejects.toThrow(/Unknown engine operation/);
  });

  it('never mutates the input', async () => {
    const src = ramp(24, 24);
    const before = Array.from(src.data);
    await runOperationAsync('medianFilter', src, {}, { bandRows: 4, yieldFn: () => Promise.resolve() });
    expect(Array.from(src.data)).toEqual(before);
  });

  it('uses the default scheduler and band size when no options are given', async () => {
    const out = await runOperationAsync('medianFilter', ramp(16, 16));
    expect(sameBytes(out, runOperation('medianFilter', ramp(16, 16)))).toBe(true);
    const banded = await runOperationAsync('meanFilter', ramp(64, 64), {}, { bandRows: 8 });
    expect(sameBytes(banded, runOperation('meanFilter', ramp(64, 64)))).toBe(true);
  });

  it('every registered op with a halo is covered by the banded test list', () => {
    const haloIds = listOperations()
      .filter((op) => op.halo !== undefined)
      .map((op) => op.id)
      .sort();
    expect(BANDED_IDS.slice().sort()).toEqual(haloIds);
  });
});
