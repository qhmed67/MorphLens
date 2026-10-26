/**
 * Synthetic fixtures shared by engine tests. No binary assets (PLAN §5).
 */
import { createImageBuffer, setPixel, type ImageBuffer } from '@/engine';

/** Solid colour image. */
export function solid(width: number, height: number, rgba: [number, number, number, number]): ImageBuffer {
  return createImageBuffer(width, height, rgba);
}

/** Horizontal grayscale ramp 0..255 across the width. */
export function ramp(width: number, height: number): ImageBuffer {
  const img = createImageBuffer(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = Math.round((x / Math.max(1, width - 1)) * 255);
      setPixel(img, x, y, [v, v, v, 255]);
    }
  }
  return img;
}

/** 8×8 constant fixture at the given grey level. */
export function constant(size: number, value: number): ImageBuffer {
  return solid(size, size, [value, value, value, 255]);
}

/** Vertical step edge: left half `a`, right half `b`. */
export function verticalStep(width: number, height: number, a: number, b: number): ImageBuffer {
  const img = createImageBuffer(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = x < width / 2 ? a : b;
      setPixel(img, x, y, [v, v, v, 255]);
    }
  }
  return img;
}

/** 3×3 fixture with values 1..9 (row-major) in all channels. */
export function known3x3(): ImageBuffer {
  const img = createImageBuffer(3, 3);
  let value = 1;
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      setPixel(img, x, y, [value, value, value, 255]);
      value += 1;
    }
  }
  return img;
}

/** Checkerboard of two grey levels. */
export function checkerboard(width: number, height: number): ImageBuffer {
  const img = createImageBuffer(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = (x + y) % 2 === 0 ? 0 : 255;
      setPixel(img, x, y, [v, v, v, 255]);
    }
  }
  return img;
}
