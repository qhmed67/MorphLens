import {
  clampByte,
  cloneImageBuffer,
  createImageBuffer,
  fromRGBA,
  getPixel,
  pixelOffset,
  sampleIndex,
  setPixel,
  toRGBA,
} from '@/engine';

describe('buffer', () => {
  it('creates an opaque image with the requested fill', () => {
    const img = createImageBuffer(2, 2, [10, 20, 30, 255]);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(img.data.length).toBe(16);
    expect(Array.from(img.data.slice(0, 4))).toEqual([10, 20, 30, 255]);
  });

  it('rejects invalid dimensions', () => {
    expect(() => createImageBuffer(0, 4)).toThrow(/Invalid image dimensions/);
    expect(() => createImageBuffer(4, 1.5)).toThrow(/Invalid image dimensions/);
  });

  it('clones without sharing storage', () => {
    const a = createImageBuffer(1, 1, [1, 2, 3, 255]);
    const b = cloneImageBuffer(a);
    b.data[0] = 99;
    expect(a.data[0]).toBe(1);
    expect(b.data[0]).toBe(99);
  });

  it('builds from RGBA and copies the bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]);
    const img = fromRGBA(2, 1, bytes);
    bytes[0] = 200;
    expect(img.data[0]).toBe(1);
    expect(() => fromRGBA(2, 1, new Uint8Array(7))).toThrow(/length mismatch/);
  });

  it('exports a fresh Uint8Array', () => {
    const img = createImageBuffer(1, 1, [5, 6, 7, 255]);
    const bytes = toRGBA(img);
    bytes[0] = 250;
    expect(img.data[0]).toBe(5);
  });

  it('clamps and rounds channel values', () => {
    expect(clampByte(-1)).toBe(0);
    expect(clampByte(256)).toBe(255);
    expect(clampByte(12.6)).toBe(13);
    expect(clampByte(12.4)).toBe(12);
  });

  it('computes pixel offsets and writes in bounds only', () => {
    const img = createImageBuffer(3, 2);
    expect(pixelOffset(2, 1, 3)).toBe(20);
    setPixel(img, 2, 1, [1, 2, 3, 77]);
    expect(Array.from(img.data.slice(20, 24))).toEqual([1, 2, 3, 77]);
    setPixel(img, -1, 0, [9, 9, 9, 255]);
    setPixel(img, 3, 0, [9, 9, 9, 255]);
    expect(img.data[0]).toBe(0);
    expect(img.data[12]).toBe(0);
  });

  it('samples clamp borders by replicating the edge', () => {
    const img = fromRGBA(2, 1, new Uint8Array([10, 0, 0, 255, 20, 0, 0, 255]));
    expect(getPixel(img, -1, 0, 'clamp')).toEqual([10, 0, 0, 255]);
    expect(getPixel(img, 5, 0, 'clamp')).toEqual([20, 0, 0, 255]);
  });

  it('samples reflect borders without repeating the edge', () => {
    const img = fromRGBA(3, 1, new Uint8Array([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255]));
    expect(getPixel(img, -1, 0, 'reflect')[0]).toBe(2);
    expect(getPixel(img, 3, 0, 'reflect')[0]).toBe(2);
    expect(getPixel(img, -2, 0, 'reflect')[0]).toBe(3);
    expect(getPixel(img, -4, 0, 'reflect')[0]).toBe(1);
  });

  it('returns transparent black outside zero borders', () => {
    const img = createImageBuffer(2, 2, [9, 9, 9, 255]);
    expect(getPixel(img, -1, -1, 'zero')).toEqual([0, 0, 0, 0]);
    expect(sampleIndex(-1, 0, 2, 2, 'zero')).toBe(-1);
    expect(sampleIndex(0, 0, 2, 2, 'zero')).toBe(0);
  });
});
