import {
  MASK_MODES,
  maskModeFromIndex,
  maskModeIndex,
  radialMask,
  runOperation,
} from '@/engine';
import { checkerboard, constant } from './fixtures';

/** Highest minus lowest channel value, used to prove a mask flattened a signal. */
function range(buffer: { data: Uint8ClampedArray }): number {
  let min = 255;
  let max = 0;
  for (let i = 0; i < buffer.data.length; i += 4) {
    min = Math.min(min, buffer.data[i]);
    max = Math.max(max, buffer.data[i]);
  }
  return max - min;
}

describe('radialMask', () => {
  it('maps mode names to registry numbers and back', () => {
    expect(MASK_MODES).toEqual(['lowpass', 'highpass', 'bandpass']);
    expect(maskModeIndex('bandpass')).toBe(2);
    expect(maskModeFromIndex(1)).toBe('highpass');
    expect(maskModeFromIndex(99)).toBe('lowpass');
  });

  it('keeps a flat image untouched with a low-pass (DC survives)', () => {
    const src = constant(16, 100);
    const out = radialMask(src, { mode: 0, cutoff: 0.1, band: 0.1, softness: 1 });
    expect(out.data[0]).toBe(100);
  });

  it('removes DC with a high-pass, so a flat image turns black', () => {
    const src = constant(16, 100);
    const out = radialMask(src, { mode: 1, cutoff: 0.1, band: 0.1, softness: 1 });
    expect(out.data[0]).toBe(0);
  });

  it('flattens a high-frequency checkerboard with a narrow low-pass', () => {
    const src = checkerboard(16, 16);
    const out = radialMask(src, { mode: 0, cutoff: 0.05, band: 0.1, softness: 1 });
    expect(range(out)).toBeLessThan(8);
    expect(range(src)).toBe(255);
  });

  it('keeps the high frequencies of a checkerboard with a wide high-pass', () => {
    const src = checkerboard(16, 16);
    const out = radialMask(src, { mode: 1, cutoff: 0.45, band: 0.1, softness: 0 });
    // The DC term is gone, so the square wave keeps its shape but is centred
    // on mid grey (the negative half clamps at 0): 0 … 128.
    expect(range(out)).toBeGreaterThan(100);
    expect(range(out)).toBeLessThan(200);
  });

  it('removes DC with a band-pass as well', () => {
    const out = radialMask(constant(16, 100), {
      mode: 2,
      cutoff: 0.2,
      band: 0.05,
      softness: 1,
    });
    expect(out.data[0]).toBe(0);
  });

  it('never mutates the source buffer', () => {
    const src = checkerboard(16, 16);
    const before = Array.from(src.data);
    radialMask(src, { mode: 1, cutoff: 0.3, band: 0.1, softness: 0 });
    expect(Array.from(src.data)).toEqual(before);
  });

  it('runs through the registry with numeric params', () => {
    const src = constant(16, 90);
    const direct = radialMask(src, { mode: 0, cutoff: 0.2, band: 0.1, softness: 1 });
    const viaRegistry = runOperation('radialMask', src, {
      mode: 0,
      cutoff: 0.2,
      band: 0.1,
      softness: 1,
    });
    expect(Array.from(viaRegistry.data)).toEqual(Array.from(direct.data));
  });
});
