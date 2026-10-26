/**
 * worker.ts — the platform side of the engine execution policy.
 *
 * Decision (PLAN open question #3, Weeks 1–2 default): heavy operations are
 * *chunked on the JS thread* and separated by frame yields, not moved to a
 * worker runtime. The SDK 58 worklet runtime can run pure functions off JS
 * (scheduleOnRuntime, spikes C1/C2), but it has no typed-array transfer path
 * documented for our Skia bridge and no Hermes device numbers yet; chunked
 * yields with exact row-band slicing (engine/exec.ts) already keep the frame
 * loop alive and are fully testable. If the device gate later shows the JS
 * thread saturated, this file is the single adaptation point: swap
 * `nextFrame` for a runtime scheduler without touching call sites.
 */
import { Platform } from 'react-native';

/**
 * Resolve on the next animation frame (or ~16 ms when rAF is unavailable).
 * Long tasks call this between row bands so React/Skia keep painting.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      // Node/Jest fallback: a macrotask is enough to release the queue.
      setTimeout(resolve, Platform.OS === 'web' ? 0 : 16);
    }
  });
}
