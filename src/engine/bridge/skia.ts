/**
 * bridge/skia.ts — the ONLY engine-adjacent file allowed to import Skia
 * (architecture.md §18.2 rule 7). It converts between the pure ImageBuffer and
 * Skia images without exposing Skia types to the engine.
 *
 * Pixel readback is CPU-side: Skia.Surface.Make (raster) is used by callers for
 * analysis, avoiding the GPU→CPU stall of MakeOffscreen (PLAN §1.3 C4/C11).
 */
import {
  AlphaType,
  ColorType,
  Skia,
  type SkImage,
  type SkSurface,
} from '@shopify/react-native-skia';
import { fromRGBA, toRGBA } from '../buffer';
import type { ImageBuffer } from '../types';

/**
 * Wrap RGBA bytes in an SkImage. `MakeImage` copies the pixel data, so the
 * buffer can be reused immediately.
 *
 * @returns null when Skia rejects the image info.
 * @complexity O(N) (pixels are copied once)
 */
export function imageBufferToSkImage(buffer: ImageBuffer): SkImage | null {
  const bytes = toRGBA(buffer);
  const data = Skia.Data.fromBytes(bytes);
  return Skia.Image.MakeImage(
    {
      width: buffer.width,
      height: buffer.height,
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    buffer.width * 4,
  );
}

/**
 * Read an SkImage back into an ImageBuffer.
 *
 * @returns null when the image has no readable CPU pixels.
 * @complexity O(N)
 */
export function skImageToImageBuffer(image: SkImage): ImageBuffer | null {
  // Force a known layout: without an explicit ImageInfo Skia may hand back
  // BGRA on some platforms, which would silently swap red and blue.
  const pixels = image.readPixels(0, 0, {
    width: image.width(),
    height: image.height(),
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels || !(pixels instanceof Uint8Array)) return null;
  return fromRGBA(image.width(), image.height(), pixels);
}

/**
 * Snapshot a CPU surface into an ImageBuffer (analysis-sized images only).
 * @complexity O(N)
 */
export function surfaceToImageBuffer(surface: SkSurface): ImageBuffer | null {
  const image = surface.makeImageSnapshot();
  return skImageToImageBuffer(image);
}

/** Allocate a CPU raster surface; callers must `dispose()` it when done. */
export function makeCpuSurface(width: number, height: number): SkSurface | null {
  return Skia.Surface.Make(width, height);
}
