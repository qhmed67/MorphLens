/**
 * imagePool — one place that owns the lifetime of GPU (Skia) images.
 *
 * Two rules the Lab screens kept re-learning the hard way:
 *
 *  1. **Never dispose an image the canvas may still be drawing.** The screen
 *     swaps to the new image during the render, but the GPU frame in flight
 *     can still reference the old one. Retiring an image after a short delay
 *     is the difference between a smooth swap and a black frame.
 *  2. **Never leave a retirement timer behind.** A pending `setTimeout` keeps
 *     the image (and its pixels) alive after the screen is gone, so the pool
 *     tracks every timer and clears them when the screen unmounts.
 *
 * The pool is created once per screen and disposed in the unmount cleanup.
 */
import type { SkImage } from '@shopify/react-native-skia';

/** How long a retired image is kept alive before it is released. */
const DEFAULT_DELAY_MS = 500;

export type ImagePool = {
  /** Retire one image: released after the canvas had time to swap. */
  retire: (image: SkImage | null, delayMs?: number) => void;
  /** Retire a whole generation (e.g. the previous stage set). */
  retireAll: (images: readonly (SkImage | null)[], delayMs?: number) => void;
  /** Release everything that is still alive — call this on unmount. */
  disposeAll: () => void;
};

/**
 * Create a pool for one screen.
 *
 * @param delayMs how long a retired image stays alive (default 500 ms)
 */
export function createImagePool(delayMs = DEFAULT_DELAY_MS): ImagePool {
  /** Image → the timer that will release it. */
  const pending = new Map<SkImage, ReturnType<typeof setTimeout>>();

  const release = (image: SkImage) => {
    pending.delete(image);
    image.dispose();
  };

  const retire = (image: SkImage | null, delay = delayMs) => {
    if (!image) return;
    // Retiring the same image twice must not schedule a second disposal.
    const existing = pending.get(image);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => release(image), delay);
    pending.set(image, timer);
  };

  return {
    retire,
    retireAll(images, delay = delayMs) {
      images.forEach((image) => retire(image, delay));
    },
    disposeAll() {
      pending.forEach((timer) => clearTimeout(timer));
      pending.forEach((_timer, image) => {
        try {
          image.dispose();
        } catch {
          // Already released — nothing to do.
        }
      });
      pending.clear();
    },
  };
}
