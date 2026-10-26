/**
 * filters.ts — the six launch filters for Creative mode.
 *
 * These are the "wow" effects the demo needs: they are pure functions on the
 * engine's `ImageBuffer`, deterministic for a given seed, and O(N) so they can
 * run on a 512 px proxy without stalling the UI. Each one is a *classic*
 * image-processing idea in a playful outfit:
 *
 *  - **Aurora**  – additive light streaks (a travelling sine wave in x, bent by y).
 *  - **Liquid**  – domain warping: the sample position is displaced by a flow field.
 *  - **Vortex**  – a swirl: the sample position rotates around the centre.
 *  - **Glitch**  – block displacement: slices of rows jump sideways.
 *  - **Duotone** – a two-stop ramp over the luma.
 *  - **Noir**    – high-contrast greyscale with a vignette.
 *
 * The design rules say the *chrome* stays monochrome and the photo carries the
 * effect, so every filter here works on luminance and never paints the UI.
 *
 * Complexity: O(W·H) per filter; the flow-field ones add a bilinear sample.
 * Reference: classic computer-graphics warps (Sourceland / "Real-Time Rendering"
 * swirls) and the classic glitch/duotone/noir photo treatments.
 */
import { clampByte, cloneImageBuffer } from '../buffer';
import { luma } from '../color/spaces';
import { createRng } from '../noise/generate';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from '../types';

/** Bilinear sample of a source buffer at fractional coordinates (clamped). */
function sampleBilinear(
  src: ImageBuffer,
  x: number,
  y: number,
  out: [number, number, number],
): void {
  const { width, height, data } = src;
  const cx = Math.min(width - 1, Math.max(0, x));
  const cy = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  for (let c = 0; c < 3; c += 1) {
    const p00 = data[(y0 * width + x0) * 4 + c];
    const p10 = data[(y0 * width + x1) * 4 + c];
    const p01 = data[(y1 * width + x0) * 4 + c];
    const p11 = data[(y1 * width + x1) * 4 + c];
    const top = p00 + (p10 - p00) * fx;
    const bottom = p01 + (p11 - p01) * fx;
    out[c] = top + (bottom - top) * fy;
  }
}

function strengthOf(params: Record<string, number>, fallback = 0.5): number {
  const value = params.strength ?? fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/** Aurora — soft vertical light streaks that drift across the frame. */
export function aurora(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const out = cloneImageBuffer(src);
  const amount = strengthOf(params);
  const bands = 1.5 + params.bands * 6;
  const { width, height, data } = out;
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % 64 === 0) ctx?.onProgress?.(y / height);
    const bend = Math.sin((y / height) * Math.PI * 2) * width * 0.06;
    for (let x = 0; x < width; x += 1) {
      const wave = Math.sin(((x + bend) / width) * Math.PI * 2 * bands);
      const glow = Math.max(0, wave) ** 3 * amount * 90;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        data[i + c] = clampByte(data[i + c] + glow);
      }
    }
  }
  ctx?.onProgress?.(1);
  return out;
}

/** Liquid — domain warp: a flow field displaces the sample position. */
export function liquid(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const out = cloneImageBuffer(src);
  const amount = strengthOf(params);
  const scale = 0.01 + params.scale * 0.05;
  const { width, height, data } = out;
  const pixel: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % 32 === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1) {
      const nx = x + Math.sin(y * scale) * width * 0.03 * amount;
      const ny = y + Math.cos(x * scale) * height * 0.03 * amount;
      sampleBilinear(src, nx, ny, pixel);
      const i = (y * width + x) * 4;
      data[i] = clampByte(pixel[0]);
      data[i + 1] = clampByte(pixel[1]);
      data[i + 2] = clampByte(pixel[2]);
    }
  }
  ctx?.onProgress?.(1);
  return out;
}

/** Vortex — swirl the image around the centre. */
export function vortex(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const out = cloneImageBuffer(src);
  const amount = strengthOf(params);
  const { width, height, data } = out;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  const pixel: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % 32 === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const falloff = 1 - Math.min(1, r / maxR);
      const angle = falloff * falloff * amount * 3.2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const zoom = 1 - falloff * amount * 0.12;
      const sx = cx + (dx * cos - dy * sin) * zoom;
      const sy = cy + (dx * sin + dy * cos) * zoom;
      sampleBilinear(src, sx, sy, pixel);
      const i = (y * width + x) * 4;
      data[i] = clampByte(pixel[0]);
      data[i + 1] = clampByte(pixel[1]);
      data[i + 2] = clampByte(pixel[2]);
    }
  }
  ctx?.onProgress?.(1);
  return out;
}

/** Glitch — horizontal blocks jump sideways, like a broken signal. */
export function glitch(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const out = cloneImageBuffer(src);
  const amount = strengthOf(params);
  const seed = Math.round(params.seed ?? 3);
  const rng = createRng(seed);
  const { width, height, data } = out;
  let y = 0;
  while (y < height) {
    const block = Math.max(2, Math.round(height * (0.01 + rng() * 0.05)));
    const shift = Math.round((rng() * 2 - 1) * width * 0.18 * amount);
    const torn = rng() < 0.35 * amount + 0.1;
    for (let row = y; row < Math.min(height, y + block); row += 1) {
      if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
      for (let x = 0; x < width; x += 1) {
        const from = torn ? Math.min(width - 1, Math.max(0, x + shift)) : x;
        const i = (row * width + x) * 4;
        data[i] = src.data[(row * width + from) * 4];
        data[i + 1] = src.data[(row * width + from) * 4 + 1];
        data[i + 2] = src.data[(row * width + from) * 4 + 2];
      }
    }
    y += block;
  }
  ctx?.onProgress?.(1);
  return out;
}

/** Duotone — a two-stop ramp over the luma (ink → paper). */
export function creativeDuotone(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const out = cloneImageBuffer(src);
  const amount = strengthOf(params, 1);
  const shadow = params.shadow ?? 18;
  const light = params.light ?? 242;
  const { data } = out;
  for (let i = 0; i < data.length; i += 4) {
    const y = luma(data[i], data[i + 1], data[i + 2]) / 255;
    const shaped = Math.pow(y, 0.92);
    const value = shadow + (light - shadow) * shaped;
    data[i] = clampByte(data[i] + (value - data[i]) * amount);
    data[i + 1] = clampByte(data[i + 1] + (value - data[i + 1]) * amount);
    data[i + 2] = clampByte(data[i + 2] + (value - data[i + 2]) * amount);
  }
  ctx?.onProgress?.(1);
  return out;
}

/** Noir — high-contrast greyscale with a vignette. */
export function noir(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  const out = cloneImageBuffer(src);
  const amount = strengthOf(params, 1);
  const contrast = 0.6 + params.contrast * 1.6;
  const vignette = params.vignette ?? 0.6;
  const { width, height, data } = out;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % 64 === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const y0 = luma(data[i], data[i + 1], data[i + 2]) / 255;
      const curved = Math.min(1, Math.max(0, (y0 - 0.5) * contrast + 0.5));
      const r = Math.hypot(x - cx, y - cy) / maxR;
      const fall = 1 - vignette * Math.max(0, r - 0.35) ** 2 * 1.8;
      const value = clampByte(curved * 255 * Math.max(0, fall));
      data[i] = clampByte(data[i] + (value - data[i]) * amount);
      data[i + 1] = clampByte(data[i + 1] + (value - data[i + 1]) * amount);
      data[i + 2] = clampByte(data[i + 2] + (value - data[i + 2]) * amount);
    }
  }
  ctx?.onProgress?.(1);
  return out;
}
