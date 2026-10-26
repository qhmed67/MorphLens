/**
 * source.ts — pixel sources for the Lab screens (pure helpers; no React, Skia
 * or engine-internal imports beyond the public types).
 *
 * Every Lab screen runs on a proxy of at most `maxEdge` pixels per side (PLAN
 * §3 shared rule; engine purity keeps resize out of `src/engine`, and this UI
 * -side box sampler is the Lab's only resizer). Imported photos arrive as
 * ≤1080 px previews and are box-downsampled; screens with no import fall back
 * to a synthetic scene so the demos always have pixels to explain.
 *
 * The synthetic scene is engineered to exercise the algorithms: smooth
 * gradients (denoise has something to preserve), a hard step edge and bars
 * (convolution/edge kernels react visibly), and a checkerboard (border-mode
 * handling shows up immediately).
 */
import { color } from '@/core/tokens';
import type { ImageBuffer } from '@/engine';

/** Parse a `#RRGGBB` token into 0..255 channels. */
function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Integer-factor box downsample: each output pixel is the mean of an `f×f`
 * block of input pixels (edge blocks shrink to the available extent). Averaging
 * — not point sampling — is what keeps noise and fine texture honest before
 * the denoise filters see them.
 *
 * @complexity O(W·H) — every input pixel is read once.
 */
export function boxDownsample(src: ImageBuffer, maxEdge: number): ImageBuffer {
  const factor = Math.ceil(Math.max(src.width, src.height) / maxEdge);
  if (factor <= 1) return src;
  const width = Math.max(1, Math.floor(src.width / factor));
  const height = Math.max(1, Math.floor(src.height / factor));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const xEnd = Math.min(src.width, (x + 1) * factor);
      const yEnd = Math.min(src.height, (y + 1) * factor);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let sy = y * factor; sy < yEnd; sy += 1) {
        for (let sx = x * factor; sx < xEnd; sx += 1) {
          const i = (sy * src.width + sx) * 4;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          count += 1;
        }
      }
      const o = (y * width + x) * 4;
      data[o] = r / count;
      data[o + 1] = g / count;
      data[o + 2] = b / count;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

/**
 * Build the synthetic Lab scene (used when no photo has been imported).
 *
 * @param size - edge length in pixels; Lab screens pass ≤384.
 * @complexity O(size²).
 */
export function makeSyntheticSource(size = 384): ImageBuffer {
  const ink = rgb(color.accent.ink);
  const graphite = rgb(color.accent.graphite);
  const silver = rgb(color.accent.silver);
  const mist = rgb(color.accent.mist);
  const paper = rgb(color.accent.paper);
  const data = new Uint8ClampedArray(size * size * 4);

  // Monochrome base: soft mist→silver diagonal with a bright paper pool in the
  // bottom-right. The demo scene stays grayscale so the chrome (also
  // monochrome) never competes with it, and structure — not hue — carries the
  // algorithms (edges, detail, noise are all luminance phenomena here).
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (2 * (size - 1));
      const pool = Math.max(0, (x / size - 0.55) * 2) * Math.max(0, (y / size - 0.45) * 2);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const base = mist[c] + (silver[c] - mist[c]) * t;
        data[i + c] = base + (paper[c] - base) * Math.min(0.55, pool * 1.4);
      }
      data[i + 3] = 255;
    }
  }

  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * size + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  };

  // Graphite disc top-left: smooth curvature + hard silhouette for median/sobel.
  const cx = Math.round(size * 0.26);
  const cy = Math.round(size * 0.28);
  const radius = Math.round(size * 0.17);
  for (let y = Math.max(0, cy - radius - 1); y < Math.min(size, cy + radius + 1); y += 1) {
    for (let x = Math.max(0, cx - radius - 1); x < Math.min(size, cx + radius + 1); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) set(x, y, ...graphite);
    }
  }

  // Checkerboard bottom-left: 8 px cells, alternating paper / ink.
  const cell = 8;
  const checkerX = Math.round(size * 0.42);
  const checkerY = Math.round(size * 0.62);
  for (let y = checkerY; y < size; y += 1) {
    for (let x = checkerX; x < size; x += 1) {
      const odd = (Math.floor((x - checkerX) / cell) + Math.floor((y - checkerY) / cell)) % 2 === 1;
      if (odd) set(x, y, ...paper);
      else set(x, y, ...ink);
    }
  }

  // Dark bars mid-left plus a hard brightness step on the right edge:
  // structured step edges are what make kernel and border behaviour readable.
  for (let band = 0; band < 5; band += 1) {
    const y0 = Math.round(size * 0.45) + band * 12;
    for (let y = y0; y < y0 + 6; y += 1) {
      for (let x = Math.round(size * 0.08); x < Math.round(size * 0.38); x += 1) {
        set(x, y, ...ink);
      }
    }
  }
  const stepX = Math.round(size * 0.82);
  for (let y = 0; y < size; y += 1) {
    for (let x = stepX; x < size; x += 1) {
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, data[i] + 60);
      data[i + 1] = Math.min(255, data[i + 1] + 60);
      data[i + 2] = Math.min(255, data[i + 2] + 60);
    }
  }

  return { width: size, height: size, data };
}
