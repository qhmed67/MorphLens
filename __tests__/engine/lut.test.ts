import { applyLut, createImageBuffer, EngineCancelledError } from '@/engine';
import { constant, ramp } from './fixtures';

/** Identity LUT: output intensity equals input intensity. */
const identity = () => Uint8Array.from({ length: 256 }, (_, index) => index);

describe('applyLut', () => {
  it('applies an identity LUT without changing pixels', () => {
    const src = ramp(32, 4);
    const out = applyLut(src, identity());
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });

  it('maps every RGB channel through the table and keeps alpha', () => {
    const src = createImageBuffer(2, 1, [10, 20, 30, 40]);
    const out = applyLut(src, Uint8Array.from({ length: 256 }, (_, index) => 255 - index));
    expect(Array.from(out.data)).toEqual([245, 235, 225, 40, 245, 235, 225, 40]);
  });

  it('clamps fractional or out-of-range table values', () => {
    const src = constant(2, 7);
    const lut = Array.from(identity());
    lut[7] = 999;
    lut[0] = -4;
    const out = applyLut(src, lut);
    expect(out.data[0]).toBe(255);
    expect(out.data[3]).toBe(255);

    const zeroSrc = constant(2, 0);
    expect(applyLut(zeroSrc, lut).data[0]).toBe(0);
  });

  it('rejects a table that is not exactly 256 entries', () => {
    expect(() => applyLut(constant(2, 0), new Uint8Array(255))).toThrow(/256-entry/);
  });

  it('reports progress and honours cancellation', () => {
    const progress: number[] = [];
    const src = createImageBuffer(4, 128);
    applyLut(src, identity(), { onProgress: (value) => progress.push(value) });
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(1);

    let calls = 0;
    expect(() =>
      applyLut(src, identity(), {
        shouldCancel: () => {
          calls += 1;
          return calls > 1;
        },
      }),
    ).toThrow(EngineCancelledError);
  });
});
