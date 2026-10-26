/**
 * build-assets-showreel.ts — bake the modern showreel's assets.
 *
 * Four different photographs, each processed by the MorphLens engine, plus the
 * 12×8 number matrices (before → after) that the reel animates.
 *
 *   public/frames/showreel/<name>.png            the photo (960×1200)
 *   public/frames/showreel/<name>_<op>.png       the engine's output
 *   public/frames/showreel/matrix_<name>.png     the 12×8 window (native)
 *   public/frames/showreel/showreel.json         the numbers
 *
 * Run: npm run assets:showreel
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import { brightness, contrast } from '../../src/engine/color/adjust';
import { unsharpMask } from '../../src/engine/enhance/sharpen';
import { luma } from '../../src/engine/color/spaces';
import type { ImageBuffer } from '../../src/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'frames', 'showreel');
const { mkdirSync } = require('node:fs') as typeof import('node:fs');
mkdirSync(out, { recursive: true });

const W = 960;
const H = 1200;
const MATRIX_COLS = 12;
const MATRIX_ROWS = 8;

function readPng(path: string): ImageBuffer {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

function writePng(path: string, buffer: ImageBuffer): void {
  const png = new PNG({ width: buffer.width, height: buffer.height });
  png.data = Buffer.from(buffer.data);
  writeFileSync(path, PNG.sync.write(png));
}

function cut(buffer: ImageBuffer, x: number, y: number, w: number, h: number): ImageBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      const from = ((y + row) * buffer.width + (x + col)) * 4;
      const to = (row * w + col) * 4;
      data[to] = buffer.data[from];
      data[to + 1] = buffer.data[from + 1];
      data[to + 2] = buffer.data[from + 2];
      data[to + 3] = buffer.data[from + 3];
    }
  }
  return { width: w, height: h, data };
}

function lumaAt(buffer: ImageBuffer, x: number, y: number): number {
  const o = (y * buffer.width + x) * 4;
  return Math.round(luma(buffer.data[o], buffer.data[o + 1], buffer.data[o + 2]));
}

/** The 12×8 window with the most local detail — where the numbers move most. */
function bestWindow(buffer: ImageBuffer): { x: number; y: number } {
  let best = { x: 0, y: 0, score: -1 };
  for (let y = 20; y < buffer.height - MATRIX_ROWS - 20; y += 12) {
    for (let x = 20; x < buffer.width - MATRIX_COLS - 20; x += 12) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let j = 0; j < MATRIX_ROWS; j += 1) {
        for (let i = 0; i < MATRIX_COLS; i += 1) {
          const v = lumaAt(buffer, x + i, y + j);
          sum += v;
          sumSq += v * v;
          n += 1;
        }
      }
      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      if (variance > best.score) best = { x, y, score: variance };
    }
  }
  return { x: best.x, y: best.y };
}

function histogram(buffer: ImageBuffer, bins = 48): number[] {
  const counts = new Array(bins).fill(0);
  let max = 0;
  for (let i = 0; i < buffer.data.length; i += 4) {
    const y = luma(buffer.data[i], buffer.data[i + 1], buffer.data[i + 2]);
    const bin = Math.min(bins - 1, Math.floor((y / 256) * bins));
    counts[bin] += 1;
    if (counts[bin] > max) max = counts[bin];
  }
  return counts.map((c) => Math.round((c / max) * 1000) / 1000);
}

/** The photos: name → file in public/frames/showreel, plus the engine op. */
const PHOTOS = [
  { name: 'neon', file: 'neon.png', op: 'brightness', amount: 110, credit: 'Billie Ward · CC BY 2.0' },
  { name: 'frost', file: 'frost.png', op: 'contrast', amount: 1.3, credit: 'Maksim Sokolov · CC BY-SA 4.0' },
  { name: 'facade', file: 'facade.png', op: 'sharpen', amount: 1.2, credit: 'PAULIX04 · CC BY-SA 4.0' },
  { name: 'ant', file: 'ant.png', op: 'sharpen', amount: 1.2, credit: 'Rhododendrites · CC BY-SA 4.0' },
];

const data: Record<string, unknown> = { photos: {}, matrix: {} };

for (const photo of PHOTOS) {
  const src = readPng(join(out, photo.file));
  let after: ImageBuffer;
  if (photo.op === 'brightness') after = brightness(src, { amount: photo.amount });
  else if (photo.op === 'contrast') after = contrast(src, { amount: photo.amount });
  else after = unsharpMask(src, { amount: photo.amount, radius: 1.4 });

  writePng(join(out, `${photo.name}_${photo.op}.png`), after);

  const win = bestWindow(src);
  writePng(join(out, `matrix_${photo.name}.png`), cut(src, win.x, win.y, MATRIX_COLS, MATRIX_ROWS));

  const before: number[] = [];
  const afterValues: number[] = [];
  for (let j = 0; j < MATRIX_ROWS; j += 1) {
    for (let i = 0; i < MATRIX_COLS; i += 1) {
      before.push(lumaAt(src, win.x + i, win.y + j));
      afterValues.push(lumaAt(after, win.x + i, win.y + j));
    }
  }

  (data.matrix as Record<string, unknown>)[photo.name] = {
    cols: MATRIX_COLS,
    rows: MATRIX_ROWS,
    x: win.x,
    y: win.y,
    before,
    after: afterValues,
  };

  (data.photos as Record<string, unknown>)[photo.name] = {
    file: photo.file,
    op: photo.op,
    amount: photo.amount,
    credit: photo.credit,
    width: src.width,
    height: src.height,
    histo: { before: histogram(src), after: histogram(after) },
    // the biggest change in the window — the reel counts it up
    peak: before.reduce(
      (best, v, i) => (Math.abs(afterValues[i] - v) > Math.abs(afterValues[best] - before[best]) ? i : best),
      0,
    ),
  };

  console.log(
    photo.name.padEnd(8),
    photo.op.padEnd(10),
    'window', win.x, win.y,
    '| peak', before[0], '→', afterValues[0],
  );
}

writeFileSync(join(out, 'showreel.json'), JSON.stringify(data, null, 2));
console.log('showreel assets →', out);
