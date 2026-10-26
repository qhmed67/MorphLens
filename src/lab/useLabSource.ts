/**
 * useLabSource — the shared pixel feed for Lab screens.
 *
 * Prefers the most recently imported photo (box-downsampled to `maxEdge`
 * through `src/lab/source.ts`); with no import it serves the synthetic scene,
 * so every Lab screen is demoable from a cold start.
 *
 * Lifetime rules (learned the hard way):
 *  - The synthetic scene is a **process-wide singleton per size**: building it
 *    costs a few dozen milliseconds, and every screen would otherwise build
 *    and leak its own copy. The hook never disposes it.
 *  - Photo-derived images belong to the hook: the previous one is retired
 *    after a beat (the canvas may still be drawing it) and the pending timer
 *    is cleared when the screen unmounts.
 */
import { useEffect, useRef, useState } from 'react';
import { useImage, type SkImage } from '@shopify/react-native-skia';
import type { ImageBuffer } from '@/engine';
import { imageBufferToSkImage, skImageToImageBuffer } from '@/engine/bridge/skia';
import { usePhotoStore } from '@/library/photoStore';
import { boxDownsample, makeSyntheticSource } from './source';

export type LabSource = {
  /** The proxy pixels the engine operates on (≤ maxEdge per side). */
  buffer: ImageBuffer | null;
  /** GPU-ready copy of the same pixels for Skia display. */
  image: SkImage | null;
  /** Human-readable provenance for the HUD caption. */
  label: string;
};

/**
 * One-entry cache for the pixels read back from the GPU.
 *
 * Reading a 1080 px preview back is the most expensive thing a Lab screen
 * does on mount. The owner moves between Lab screens with the same photo, so
 * the last readback (and the last down-sampled proxy) is kept: the next
 * screen starts with pixels instead of waiting for the GPU.
 *
 * One entry per kind keeps the memory bounded (a 1080² buffer is ~5 MB).
 */
const readbackCache: { key: string; buffer: ImageBuffer | null } = { key: '', buffer: null };
const proxyCache: { key: string; buffer: ImageBuffer | null } = { key: '', buffer: null };

/** Synthetic scene per size, shared by every screen that asks for it. */
const syntheticCache = new Map<number, { buffer: ImageBuffer; image: SkImage | null }>();

function syntheticFor(size: number): { buffer: ImageBuffer; image: SkImage | null } {
  const cached = syntheticCache.get(size);
  if (cached) return cached;
  const buffer = makeSyntheticSource(size);
  const entry = { buffer, image: imageBufferToSkImage(buffer) };
  syntheticCache.set(size, entry);
  return entry;
}

/**
 * Track the current Lab pixel source. Re-runs when the preview image loads or
 * the max edge changes; keeps the previous source visible until the new one is
 * ready so the screens never flash empty.
 *
 * @param maxEdge - proxy long-edge cap in pixels.
 * @param requestedId - photo id to use; defaults to the most recent import.
 */
export function useLabSource(maxEdge = 384, requestedId?: string): LabSource {
  const latestId = usePhotoStore((state) => state.order[0]);
  const photoId = requestedId ?? latestId;
  const photo = usePhotoStore((state) => (photoId ? state.photos[photoId] : undefined));
  const preview = useImage(photo?.previewUri ?? null);
  const [source, setSource] = useState<LabSource>(() => {
    const synthetic = syntheticFor(maxEdge);
    return {
      buffer: synthetic.buffer,
      image: synthetic.image,
      label: 'Synthetic scene',
    };
  });
  const sourceRef = useRef(source);
  /** Images that are on their way out, with the timer that will release them. */
  const retired = useRef(new Map<SkImage, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = retired.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.forEach((_timer, image) => {
        try {
          image.dispose();
        } catch {
          // Already released — nothing to do.
        }
      });
      pending.clear();
      // The synthetic image is shared and must not be disposed here; only the
      // photo-derived copy belongs to this hook.
      const current = sourceRef.current;
      if (current.image && current.label !== 'Synthetic scene') current.image.dispose();
    };
  }, []);

  useEffect(() => {
    if (!preview) return; // no import yet — keep the synthetic scene
    // The readback + box downsample costs milliseconds on a 1080² preview;
    // defer it to a macrotask so the commit that delivered the image stays
    // cheap, and drop the work if a newer preview supersedes this one.
    let cancelled = false;
    const timer = setTimeout(() => {
      const photoKey = photoId ?? '';
      const proxyKey = `${photoKey}:${maxEdge}`;
      let buffer: ImageBuffer | null = null;
      if (proxyCache.key === proxyKey && proxyCache.buffer) {
        buffer = proxyCache.buffer;
      } else {
        let full: ImageBuffer | null = null;
        if (readbackCache.key === photoKey) {
          full = readbackCache.buffer;
        } else {
          full = skImageToImageBuffer(preview);
          readbackCache.key = photoKey;
          readbackCache.buffer = full;
        }
        if (!full) return;
        buffer = boxDownsample(full, maxEdge);
        proxyCache.key = proxyKey;
        proxyCache.buffer = buffer;
      }
      if (!buffer || cancelled) return;
      const image = imageBufferToSkImage(buffer);
      if (!image) return;
      if (cancelled) {
        image.dispose();
        return;
      }
      const next = { buffer, image, label: `Photo · ${buffer.width}×${buffer.height} proxy` };
      const previous = sourceRef.current;
      sourceRef.current = next;
      setSource(next);
      if (previous.image && previous.label !== 'Synthetic scene') {
        const image = previous.image;
        const timer = setTimeout(() => {
          retired.current.delete(image);
          image.dispose();
        }, 1000);
        retired.current.set(image, timer);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [photoId, preview, maxEdge]);

  return source;
}
