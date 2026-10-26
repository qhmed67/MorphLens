import {
  autoLevels,
  contrastStretch,
  createImageBuffer,
  EngineCancelledError,
  getPixel,
  laplacianSharpen,
  setPixel,
  unsharpMask,
  type ImageBuffer,
} from '@/engine';
import { constant as constantFixture, verticalStep as stepFixture } from './fixtures';

/** 3×1 grey image holding the values 100, 150 and 200. */
function knownRange(): ImageBuffer {
  const img = createImageBuffer(3, 1);
  setPixel(img, 0, 0, [100, 100, 100, 255]);
  setPixel(img, 1, 0, [150, 150, 150, 255]);
  setPixel(img, 2, 0, [200, 200, 200, 255]);
  return img;
}

describe('contrastStretch', () => {
  it('maps 150 to 128 for a [100, 200] luma range (stretch-100-200)', () => {
    const out = contrastStretch(knownRange(), { mode: 0 });
    expect(getPixel(out, 0, 0)[0]).toBe(0); // (100−100)·255/100
    expect(getPixel(out, 1, 0)[0]).toBe(128); // 127.5 rounds up
    expect(getPixel(out, 2, 0)[0]).toBe(255);
  });

  it('leaves a degenerate (flat) range untouched', () => {
    const src = constantFixture(8, 90);
    expect(Array.from(contrastStretch(src, { mode: 0 }).data)).toEqual(Array.from(src.data));
  });

  it('stretches each channel independently in per-channel mode', () => {
    const img = createImageBuffer(2, 1);
    setPixel(img, 0, 0, [100, 100, 0, 255]);
    setPixel(img, 1, 0, [200, 100, 0, 255]);
    const out = contrastStretch(img, { mode: 1 });
    expect(getPixel(out, 0, 0)[0]).toBe(0); // red: [100,200] → [0,255]
    expect(getPixel(out, 1, 0)[0]).toBe(255);
    // Green/blue are flat → identity, not pushed to black/white.
    expect(getPixel(out, 0, 0)[1]).toBe(100);
    expect(getPixel(out, 1, 0)[1]).toBe(100);
    expect(getPixel(out, 0, 0)[2]).toBe(0);
  });

  it('throws when cancelled', () => {
    expect(() => contrastStretch(knownRange(), {}, { shouldCancel: () => true })).toThrow(
      EngineCancelledError,
    );
  });
});

describe('autoLevels', () => {
  it('equals a per-channel stretch of the same image', () => {
    const src = knownRange();
    const auto = autoLevels(src);
    const perChannel = contrastStretch(src, { mode: 1 });
    expect(Array.from(auto.data)).toEqual(Array.from(perChannel.data));
  });
});

describe('unsharpMask', () => {
  it('is the identity at amount 0', () => {
    const src = stepFixture(16, 16, 80, 160);
    expect(Array.from(unsharpMask(src, { amount: 0, radius: 1.4 }).data)).toEqual(
      Array.from(src.data),
    );
  });

  it('overshoots the bright side and undershoots the dark side of an edge', () => {
    const src = stepFixture(64, 64, 100, 150);
    const out = unsharpMask(src, { amount: 1, radius: 1.4 });
    expect(getPixel(out, 31, 32)[0]).toBeLessThanOrEqual(90); // dark side: pulled down
    expect(getPixel(out, 32, 32)[0]).toBeGreaterThanOrEqual(160); // bright side: pushed up
    // Flat far field is untouched (blur == original there).
    expect(getPixel(out, 5, 5)[0]).toBe(100);
  });
});

describe('laplacianSharpen', () => {
  it('keeps a constant image constant (zero-sum kernel)', () => {
    const src = constantFixture(8, 128);
    expect(Array.from(laplacianSharpen(src, { amount: 1 }).data)).toEqual(Array.from(src.data));
  });

  it('produces the hand-computed values around a step edge', () => {
    const src = stepFixture(64, 64, 100, 150);
    const out = laplacianSharpen(src, { amount: 1 });
    // ∇²(31) = 4·100 − (100+100+100+150) = −50 → 100 − 50 = 50
    expect(getPixel(out, 31, 32)[0]).toBe(50);
    // ∇²(32) = 4·150 − (100+150+150+150) = +50 → 150 + 50 = 200
    expect(getPixel(out, 32, 32)[0]).toBe(200);
  });

  it('throws when cancelled', () => {
    expect(() =>
      laplacianSharpen(stepFixture(16, 16, 10, 20), {}, { shouldCancel: () => true }),
    ).toThrow(EngineCancelledError);
  });
});
