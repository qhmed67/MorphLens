/**
 * edges.ts — gradient edge operators (Sobel, Prewitt) and the Canny
 * detector with exposed stage intermediates.
 *
 * Theory: an edge is a local maximum of the image gradient. Sobel and
 * Prewitt smooth (3-tap average) and differentiate (2-tap difference) in one
 * 3×3 sweep, giving signed Gx/Gy; the displayed response is the magnitude
 * hypot(Gx, Gy) normalised by the largest possible response (maxSum·√2·255)
 * so thresholds live in 0..255.
 *
 * Canny's optimal-detector pipeline (all stages kept because Lab screen 3
 * visualises them):
 *   1. Gaussian smoothing σ — suppress noise before differentiating.
 *   2. Sobel gradient magnitude and direction (on Rec.709 luma).
 *   3. Non-maximum suppression — keep only ridge pixels along the gradient
 *      direction (thin the edges to one pixel).
 *   4. Double threshold + hysteresis — "strong" pixels seed a flood fill that
 *      adopts connected "weak" ones, so faint edges survive only when they
 *      continue a confident one.
 *
 * Formulas:
 *   sobel    Gx = [[−1 0 1][−2 0 2][−1 0 1]] * luma   (Prewitt: all 1s)
 *   display  mag = hypot(Gx,Gy) / (maxSum·√2)
 *   nms      keep mag(p) ≥ mag(p ± neighbour along ∇)
 *
 * Complexity: gradient O(N·9); Canny O(N·9 + N) with a linear hysteresis BFS.
 * Reference: Gonzalez & Woods, "Image Enhancement — Gradient"; Canny,
 * "A Computational Approach to Edge Detection", PAMI 1986.
 */
import { clampByte, sampleIndex } from '../buffer';
import { luma } from '../color/spaces';
import { gaussianFilter } from '../noise/denoise';
import { EngineCancelledError, type ImageBuffer, type RunCtx } from '../types';

/** Progress is reported every 32 rows (these passes are heavier than point ops). */
const PROGRESS_ROWS = 32;

/** Largest absolute kernel weight sum: Sobel 4, Prewitt 3. */
function maxWeightSum(kind: 'sobel' | 'prewitt'): number {
  return kind === 'sobel' ? 4 : 3;
}

/** Signed Sobel/Prewitt gradient on the Rec.709 luma plane. */
function gradientPlanes(
  src: ImageBuffer,
  kind: 'sobel' | 'prewitt',
  ctx?: RunCtx,
): { gx: Float32Array; gy: Float32Array; lumaPlane: Float32Array } {
  const { width, height, data } = src;
  const lumaPlane = new Float32Array(width * height);
  for (let p = 0, i = 0; p < data.length; p += 4, i += 1) {
    lumaPlane[i] = luma(data[p], data[p + 1], data[p + 2]);
  }
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  // Row/centre weights differ between the two operators, the difference term
  // does not: gx = Σ w_row·(luma right − luma left).
  const rows: readonly number[] = kind === 'sobel' ? [1, 2, 1] : [1, 1, 1];
  for (let y = 0; y < height; y += 1) {
    if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
    if (y % PROGRESS_ROWS === 0) ctx?.onProgress?.(y / height);
    for (let x = 0; x < width; x += 1) {
      let sumX = 0;
      let sumY = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        const rowOffset = rows[ky + 1];
        // sampleIndex returns a byte offset; lumaPlane is indexed per pixel.
        const left = sampleIndex(x - 1, y + ky, width, height, 'clamp') >> 2;
        const right = sampleIndex(x + 1, y + ky, width, height, 'clamp') >> 2;
        const up = sampleIndex(x + ky, y - 1, width, height, 'clamp') >> 2;
        const down = sampleIndex(x + ky, y + 1, width, height, 'clamp') >> 2;
        sumX += rowOffset * (lumaPlane[right] - lumaPlane[left]);
        sumY += rowOffset * (lumaPlane[down] - lumaPlane[up]);
      }
      gx[y * width + x] = sumX;
      gy[y * width + x] = sumY;
    }
  }
  return { gx, gy, lumaPlane };
}

/**
 * Gradient-magnitude edge map (white on black).
 *
 * @param params.threshold minimum 0..255 magnitude kept (default 0 = keep all)
 * @param ctx progress/cancel hooks
 * @complexity O(W·H·9)
 */
export function sobelEdges(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  return gradientEdges(src, 'sobel', params.threshold ?? 0, ctx);
}

/**
 * Prewitt gradient-magnitude edge map (white on black).
 *
 * @param params.threshold minimum 0..255 magnitude kept (default 0 = keep all)
 * @param ctx progress/cancel hooks
 * @complexity O(W·H·9)
 */
export function prewittEdges(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  return gradientEdges(src, 'prewitt', params.threshold ?? 0, ctx);
}

/** Shared body of the two gradient operators. */
function gradientEdges(
  src: ImageBuffer,
  kind: 'sobel' | 'prewitt',
  thresholdParam: number,
  ctx?: RunCtx,
): ImageBuffer {
  const threshold = Math.min(255, Math.max(0, thresholdParam));
  const { gx, gy } = gradientPlanes(src, kind, ctx);
  const { width, height } = src;
  // Normalise so the strongest possible response (checker corner, hypot of
  // both axes at max) maps to 255; thresholds then live on the display scale.
  const scale = 1 / (maxWeightSum(kind) * Math.SQRT2);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gx.length; i += 1) {
    const mag = Math.hypot(gx[i], gy[i]) * scale;
    const value = mag >= threshold ? clampByte(mag) : 0;
    const o = i * 4;
    out[o] = value;
    out[o + 1] = value;
    out[o + 2] = value;
    out[o + 3] = 255;
  }
  ctx?.onProgress?.(1);
  return { width, height, data: out };
}

/** The four pipeline images of one Canny run (Lab screen 3 shows all of them). */
export type CannyStages = {
  /** Gaussian-smoothed image (grayscale). */
  blur: ImageBuffer;
  /** Normalised gradient magnitude 0..255. */
  magnitude: ImageBuffer;
  /** Ridges kept by non-maximum suppression. */
  nonMax: ImageBuffer;
  /** Final one-pixel edges after double threshold + hysteresis. */
  edges: ImageBuffer;
};

/**
 * Canny edge detection with every intermediate exposed.
 *
 * @param params.sigma   Gaussian σ of stage 1, 0.5..3 (default 1.4)
 * @param params.low     weak threshold as a fraction of max magnitude 0..1 (default 0.1)
 * @param params.high    strong threshold as a fraction of max magnitude 0..1 (default 0.3)
 * @param ctx progress/cancel hooks
 * @complexity O(W·H·9) plus a linear flood fill
 */
export function cannyStages(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): CannyStages {
  const sigma = Math.min(3, Math.max(0.5, params.sigma ?? 1.4));
  const lowFrac = Math.min(1, Math.max(0, params.low ?? 0.1));
  const highFrac = Math.min(1, Math.max(0, params.high ?? 0.3));
  const { width, height } = src;

  // Stage 1: Gaussian smoothing (also rendered grayscale for the visualiser).
  const blurred = gaussianFilter(src, { sigma }, ctx);
  const grey = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, q = 0; p < blurred.data.length; p += 4, q += 4) {
    const value = luma(blurred.data[p], blurred.data[p + 1], blurred.data[p + 2]);
    grey[q] = value;
    grey[q + 1] = value;
    grey[q + 2] = value;
    grey[q + 3] = 255;
  }
  const blurImage: ImageBuffer = { width, height, data: grey };

  // Stage 2: Sobel gradient on the smoothed luma.
  if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
  const { gx, gy } = gradientPlanes(blurImage, 'sobel', ctx);
  const mag = new Float32Array(width * height);
  let maxMag = 0;
  for (let i = 0; i < mag.length; i += 1) {
    mag[i] = Math.hypot(gx[i], gy[i]);
    if (mag[i] > maxMag) maxMag = mag[i];
  }
  const magScale = maxMag > 0 ? 255 / maxMag : 0;
  const magImage = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mag.length; i += 1) {
    const value = clampByte(mag[i] * magScale);
    const o = i * 4;
    magImage[o] = value;
    magImage[o + 1] = value;
    magImage[o + 2] = value;
    magImage[o + 3] = 255;
  }

  // Flat image: no gradient at all → every stage is black (a 0 threshold
  // would otherwise promote all pixels to "strong").
  if (maxMag === 0) {
    const black = new Uint8ClampedArray(width * height * 4);
    for (let p = 3; p < black.length; p += 4) black[p] = 255;
    const blank: ImageBuffer = { width, height, data: black };
    ctx?.onProgress?.(1);
    return { blur: blurImage, magnitude: { width, height, data: magImage }, nonMax: blank, edges: blank };
  }

  // Stage 3: non-maximum suppression along the quantised gradient axis.
  // strong/weak flags share one byte array to keep the hot loop tight:
  // 0 none, 1 weak, 2 strong (pre-NMS), 3 strong (post-hysteresis).
  const flags = new Uint8Array(width * height);
  const nmsImage = new Uint8ClampedArray(width * height * 4);
  const lowT = lowFrac * maxMag;
  const highT = highFrac * maxMag;
  if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
  ctx?.onProgress?.(0.55);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = mag[i];
      if (value < lowT) continue; // below weak threshold: not an edge candidate
      // Fold the gradient angle into [0, π) and pick the comparison pair on
      // that axis (sign of the gradient does not change the axis).
      const angle = Math.atan2(gy[i], gx[i]);
      const folded = angle < 0 ? angle + Math.PI : angle;
      let n1: number;
      let n2: number;
      if (folded < Math.PI / 8 || folded >= (7 * Math.PI) / 8) {
        n1 = mag[i - 1];
        n2 = mag[i + 1];
      } else if (folded < (3 * Math.PI) / 8) {
        n1 = mag[i - width - 1]; // 45°: (x−1, y−1) and (x+1, y+1)
        n2 = mag[i + width + 1];
      } else if (folded < (5 * Math.PI) / 8) {
        n1 = mag[i - width]; // vertical axis
        n2 = mag[i + width];
      } else {
        n1 = mag[i - width + 1]; // 135°: (x+1, y−1) and (x−1, y+1)
        n2 = mag[i + width - 1];
      }
      if (value >= n1 && value >= n2) {
        flags[i] = value >= highT ? 2 : 1;
        const o = i * 4;
        const display = clampByte(value * magScale);
        nmsImage[o] = display;
        nmsImage[o + 1] = display;
        nmsImage[o + 2] = display;
        nmsImage[o + 3] = 255;
      }
    }
  }

  // Stage 4: hysteresis — flood-fill from every strong pixel into weak ones.
  if (ctx?.shouldCancel?.()) throw new EngineCancelledError();
  ctx?.onProgress?.(0.8);
  const stack: number[] = [];
  for (let i = 0; i < flags.length; i += 1) {
    if (flags[i] === 2) {
      flags[i] = 3;
      stack.push(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % width;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = (i / width | 0) + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (flags[n] === 1) {
          flags[n] = 3; // weak edge connected to a strong one becomes strong
          stack.push(n);
        }
      }
    }
  }
  const edgeImage = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < flags.length; i += 1) {
    const o = i * 4;
    edgeImage[o] = flags[i] === 3 ? 255 : 0;
    edgeImage[o + 1] = flags[i] === 3 ? 255 : 0;
    edgeImage[o + 2] = flags[i] === 3 ? 255 : 0;
    edgeImage[o + 3] = 255;
  }
  ctx?.onProgress?.(1);
  return {
    blur: blurImage,
    magnitude: { width, height, data: magImage },
    nonMax: { width, height, data: nmsImage },
    edges: { width, height, data: edgeImage },
  };
}

/**
 * Canny edges only (the final stage). Use {@link cannyStages} when the Lab
 * screen needs the pipeline images.
 *
 * @complexity O(W·H·9)
 */
export function canny(
  src: ImageBuffer,
  params: Record<string, number>,
  ctx?: RunCtx,
): ImageBuffer {
  return cannyStages(src, params, ctx).edges;
}
