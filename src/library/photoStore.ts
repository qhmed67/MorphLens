/**
 * photoStore.ts — in-memory library of imported photos for Week 1.
 *
 * Discrete events only (add photo, open editor). Persistence moves to the
 * recipe store with AsyncStorage in Week 4; keeping this tiny now avoids
 * committing to a persistence format before recipes exist.
 */
import { create } from 'zustand';
import { deleteIfExists } from './files';
import type { ImportedPhoto } from './import';

/**
 * How many imports a session keeps. Every import writes three files into the
 * sandbox, so an unbounded session would slowly fill the device; the oldest
 * import is dropped (and its files deleted) once the cap is reached.
 */
export const MAX_SESSION_PHOTOS = 8;

type PhotoState = {
  photos: Record<string, ImportedPhoto>;
  order: string[];
  add: (photo: ImportedPhoto) => void;
  get: (id: string) => ImportedPhoto | undefined;
};

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: {},
  order: [],
  add: (photo) =>
    set((state) => {
      const order = [photo.id, ...state.order.filter((id) => id !== photo.id)];
      // Drop the oldest imports (and their files) past the cap.
      const evicted = order.slice(MAX_SESSION_PHOTOS);
      if (evicted.length > 0) {
        evicted.forEach((id) => {
          const dropped = state.photos[id];
          if (!dropped) return;
          deleteIfExists(dropped.originalUri);
          deleteIfExists(dropped.previewUri);
          deleteIfExists(dropped.thumbUri);
        });
      }
      const photos = { ...state.photos, [photo.id]: photo };
      evicted.forEach((id) => {
        delete photos[id];
      });
      return { photos, order: order.slice(0, MAX_SESSION_PHOTOS) };
    }),
  get: (id) => get().photos[id],
}));
