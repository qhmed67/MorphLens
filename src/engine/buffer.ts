/**
 * buffer.ts — RGBA image containers, pixel access and border handling.
 *
 * Theory: an image is a 2-D discrete function f(x, y) with four 8-bit
 * channels. Spatial kernels need samples outside the image; the three classic
 * policies are clamp (replicate edge), reflect (mirror) and zero (black).
 *
 * Complexity: creation/copy O(W·H); pixel access O(1).
 * Reference: Gonzalez & Woods, Digital Image Processing — "Image Fundamentals".
 */
import type { BorderMode, ImageBuffer } from './types';

/** RGBA tuple in 0..255. */
export type RGBA = readonly [number, number, number, number];

/** Clamp a numeric channel value into the byte range with rounding. */
export function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

/** Throw a helpful error for malformed image dimensions. */
function assertDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid image dimensions: ${width}×${height}`);
  }
}

/**
 * Allocate an opaque image filled with one colour (default black).
 *
 * @complexity O(W·H)
 */
export function createImageBuffer(
  width: number,
  height: number,
  fill: RGBA = [0, 0, 0, 255],
): ImageBuffer {
  assertDimensions(width, height);
  const data = new Uint8ClampedArray(width * height * 4);
  const [r, g, b, a] = fill;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { width, height, data };
}

/** Deep-copy an image buffer so callers can never mutate each other's input. */
export function cloneImageBuffer(src: ImageBuffer): ImageBuffer {
  return {
    width: src.width,
    height: src.height,
    data: new Uint8ClampedArray(src.data),
  };
}

/**
 * Build an ImageBuffer from raw RGBA bytes (copied, never aliased).
 *
 * @throws if `data.length !== width * height * 4`
 */
export function fromRGBA(
  width: number,
  height: number,
  data: Uint8Array | Uint8ClampedArray | readonly number[],
): ImageBuffer {
  assertDimensions(width, height);
  const expected = width * height * 4;
  if (data.length !== expected) {
    throw new Error(`RGBA length mismatch: expected ${expected}, got ${data.length}`);
  }
  return { width, height, data: new Uint8ClampedArray(data) };
}

/** Export the buffer as a fresh Uint8Array (safe for Skia.Data.fromBytes). */
export function toRGBA(src: ImageBuffer): Uint8Array {
  return new Uint8Array(src.data);
}

/** Byte offset of pixel (x, y). No bounds checking. */
export function pixelOffset(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

/** Map a possibly out-of-range coordinate to an in-range one. */
function mapCoordinate(value: number, size: number, mode: BorderMode): number {
  if (value >= 0 && value < size) return value;
  if (mode === 'zero') return -1;
  if (mode === 'clamp') return value < 0 ? 0 : size - 1;
  // Mirror without repeating the edge pixel (OpenCV BORDER_REFLECT_101).
  const period = 2 * (size - 1);
  if (period === 0) return 0;
  const wrapped = ((value % period) + period) % period;
  return wrapped >= size ? period - wrapped : wrapped;
}

/**
 * Read a pixel with explicit border policy.
 *
 * @complexity O(1) for clamp, O(log n) worst case for reflect, O(1) zero.
 */
export function getPixel(
  src: ImageBuffer,
  x: number,
  y: number,
  border: BorderMode = 'clamp',
): RGBA {
  const sx = mapCoordinate(x, src.width, border);
  const sy = mapCoordinate(y, src.height, border);
  if (sx < 0 || sy < 0) return [0, 0, 0, 0];
  const i = pixelOffset(sx, sy, src.width);
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
}

/** Write one RGBA pixel in place (clamped). Intended for construction helpers. */
export function setPixel(src: ImageBuffer, x: number, y: number, rgba: RGBA): void {
  if (x < 0 || y < 0 || x >= src.width || y >= src.height) return;
  const i = pixelOffset(x, y, src.width);
  src.data[i] = clampByte(rgba[0]);
  src.data[i + 1] = clampByte(rgba[1]);
  src.data[i + 2] = clampByte(rgba[2]);
  src.data[i + 3] = clampByte(rgba[3]);
}

/**
 * Resolve a sample coordinate for kernels. Returns -1 when the policy is
 * `zero` and the coordinate falls outside the image.
 */
export function sampleIndex(
  x: number,
  y: number,
  width: number,
  height: number,
  border: BorderMode,
): number {
  const sx = mapCoordinate(x, width, border);
  const sy = mapCoordinate(y, height, border);
  if (sx < 0 || sy < 0) return -1;
  return pixelOffset(sx, sy, width);
}
