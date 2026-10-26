import {
  clahe,
  createImageBuffer,
  EngineCancelledError,
  getPixel,
  grayWorldWB,
  setPixel,
  whitePatchWB,
  type ImageBuffer,
} from '@/engine';
import { constant as constantFixture, ramp } from './fixtures';

/** 2×1 image with a known per-channel mean (r=150, g=100, b=50). */
function knownMeans(): ImageBuffer {
  const img = createImageBuffer(2, 1);
  setPixel(img, 0, 0, [200, 50, 10, 255]);
  setPixel(img, 1, 0, [100, 150, 90, 255]);
  return img;
}

/** Channel means of an image in 0..255. */
function channelMeans(img: ImageBuffer): [number, number, number] {
  const sums = [0, 0, 0];
  const pixels = img.data.length / 4;
  for (let p = 0; p < img.data.length; p += 4) {
    sums[0] += img.data[p];
    sums[1] += img.data[p + 1];
    sums[2] += img.data[p + 2];
  }
  return [sums[0] / pixels, sums[1] / pixels, sums[2] / pixels];
}

describe('grayWorldWB', () => {
  it('leaves a neutral grey image unchanged (gains are 1)', () => {
    const src = constantFixture(8, 128);
    expect(Array.from(grayWorldWB(src, { strength: 1 }).data)).toEqual(Array.from(src.data));
  });

  it('equalises the channel means to the gray-world target', () => {
    const out = grayWorldWB(knownMeans(), { strength: 1 });
    const [r, g, b] = channelMeans(out);
    const target = (150 + 100 + 50) / 3; // 100
    expect(Math.abs(r - target)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - target)).toBeLessThanOrEqual(1);
    expect(Math.abs(b - target)).toBeLessThanOrEqual(1);
  });

  it('is the identity at strength 0', () => {
    const src = knownMeans();
    expect(Array.from(grayWorldWB(src, { strength: 0 }).data)).toEqual(Array.from(src.data));
  });

  it('does not divide by zero on an all-black channel', () => {
    const img = createImageBuffer(2, 1);
    setPixel(img, 0, 0, [200, 0, 0, 255]);
    setPixel(img, 1, 0, [100, 0, 0, 255]);
    const out = grayWorldWB(img, { strength: 1 });
    expect(getPixel(out, 0, 0)[1]).toBe(0);
    expect(getPixel(out, 1, 0)[1]).toBe(0);
  });
});

describe('whitePatchWB', () => {
  it('pushes each channel maximum to exactly 255', () => {
    const img = createImageBuffer(2, 1);
    setPixel(img, 0, 0, [200, 80, 40, 255]);
    setPixel(img, 1, 0, [100, 40, 20, 255]);
    const out = whitePatchWB(img, { strength: 1 });
    expect(getPixel(out, 0, 0)[0]).toBe(255);
    expect(getPixel(out, 0, 0)[1]).toBe(255);
    expect(getPixel(out, 0, 0)[2]).toBe(255);
    // Ratios inside a channel are preserved by a pure gain. The blended gain
    // 1+(255/200−1) lands a hair below 1.275 in IEEE-754, so 100·gain rounds
    // to 127 rather than 128 — accept the ±1 float slack.
    expect(Math.abs(getPixel(out, 1, 0)[0] - 127.5)).toBeLessThanOrEqual(1);
  });

  it('is the identity at strength 0 and guards zero channels', () => {
    const img = createImageBuffer(1, 1);
    setPixel(img, 0, 0, [200, 0, 40, 255]);
    expect(Array.from(whitePatchWB(img, { strength: 0 }).data)).toEqual(Array.from(img.data));
    expect(getPixel(whitePatchWB(img, { strength: 1 }), 0, 0)[1]).toBe(0);
  });
});

describe('clahe', () => {
  it('maps a constant image to a single uniform value (no tile seams)', () => {
    const src = constantFixture(128, 100);
    const out = clahe(src, { tiles: 8, clip: 3 });
    const first = out.data[0];
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(first);
      expect(out.data[i + 1]).toBe(first);
      expect(out.data[i + 2]).toBe(first);
    }
  });

  it('produces different output for different clip limits', () => {
    const src = ramp(64, 64);
    const gentle = clahe(src, { tiles: 8, clip: 1 });
    const strong = clahe(src, { tiles: 8, clip: 8 });
    expect(Array.from(gentle.data)).not.toEqual(Array.from(strong.data));
  });

  it('snaps the tile grid onto {4, 8, 16} and stays in byte range', () => {
    const src = ramp(32, 32);
    const out = clahe(src, { tiles: 5.2, clip: 3 }); // snaps to 4
    for (let i = 0; i < out.data.length; i += 1) {
      expect(out.data[i]).toBeGreaterThanOrEqual(0);
      expect(out.data[i]).toBeLessThanOrEqual(255);
    }
    expect(() => clahe(src, { tiles: 8, clip: 3 }, { shouldCancel: () => true })).toThrow(
      EngineCancelledError,
    );
  });
});
