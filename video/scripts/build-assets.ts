/**
 * build-assets.ts — bake the reel's visual assets from the *real* app engine.
 *
 * Everything the video shows is computed by the same TypeScript code the
 * MorphLens app runs on the device (`src/engine/**`), so the numbers on
 * screen are the numbers the app actually produces:
 *
 *   hero.png          the source photo (960×1440)
 *   hero_bright.png   brightness +40  (out = clamp(in + b))
 *   hero_contrast.png contrast ×1.30  (out = (in − 128)·c + 128)
 *   hero_blur.png     gaussian σ=1.4  (the low-pass of the unsharp mask)
 *   hero_detail.png   in − blur, gain 4 (the detail layer)
 *   hero_sharp.png    unsharp mask, amount 1.2, radius 1.4
 *   data.json         pixel addresses + values, histograms, probe pixel
 *
 * Run: npm run assets
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import { brightness, contrast } from '../../src/engine/color/adjust';
import { unsharpMask } from '../../src/engine/enhance/sharpen';
import { gaussianFilter } from '../../src/engine/noise/denoise';
import { luma } from '../../src/engine/color/spaces';
import type { ImageBuffer } from '../../src/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const frames = join(here, '..', 'public', 'frames');

/** Parameters used by the reel — mirrored in the captions. */
const BRIGHT_AMOUNT = 40;
const CONTRAST_AMOUNT = 1.3;
const SHARP_AMOUNT = 1.2;
const SHARP_RADIUS = 1.4;

/** The magnified window the reel zooms into (16×16 source pixels). */
const CROP_SIZE = 16;
const CROP_X = 392;
const CROP_Y = 476;

function readPng(path: string): ImageBuffer {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

function writePng(path: string, buffer: ImageBuffer): void {
  const png = new PNG({ width: buffer.width, height: buffer.height });
  png.data = Buffer.from(buffer.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** Cut a `size`×`size` window out of a buffer. */
function cut(buffer: ImageBuffer, x: number, y: number, size: number): ImageBuffer {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const from = ((y + row) * buffer.width + (x + col)) * 4;
      const to = (row * size + col) * 4;
      data[to] = buffer.data[from];
      data[to + 1] = buffer.data[from + 1];
      data[to + 2] = buffer.data[from + 2];
      data[to + 3] = buffer.data[from + 3];
    }
  }
  return { width: size, height: size, data };
}

function pixelAt(buffer: ImageBuffer, x: number, y: number) {
  const o = (y * buffer.width + x) * 4;
  const r = buffer.data[o];
  const g = buffer.data[o + 1];
  const b = buffer.data[o + 2];
  return { r, g, b, luma: Math.round(luma(r, g, b)) };
}

/** Signed difference map, exactly like `src/lab/stages.ts` differenceMap(). */
function differenceMap(a: ImageBuffer, b: ImageBuffer, gain = 4): ImageBuffer {
  const data = new Uint8ClampedArray(a.data.length);
  for (let i = 0; i < a.data.length; i += 4) {
    data[i] = 128 + (a.data[i] - b.data[i]) * gain;
    data[i + 1] = 128 + (a.data[i + 1] - b.data[i + 1]) * gain;
    data[i + 2] = 128 + (a.data[i + 2] - b.data[i + 2]) * gain;
    data[i + 3] = 255;
  }
  return { width: a.width, height: a.height, data };
}

/** 64-bin luma histogram (the app's HUD histogram resolution). */
function histogram(buffer: ImageBuffer, bins = 64): number[] {
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

const hero = readPng(join(frames, 'hero.png'));

const bright = brightness(hero, { amount: BRIGHT_AMOUNT });
const contrasted = contrast(hero, { amount: CONTRAST_AMOUNT });
const blurred = gaussianFilter(hero, { sigma: SHARP_RADIUS });
const detail = differenceMap(hero, blurred, 4);
const sharpened = unsharpMask(hero, { amount: SHARP_AMOUNT, radius: SHARP_RADIUS });

writePng(join(frames, 'hero_bright.png'), bright);
writePng(join(frames, 'hero_contrast.png'), contrasted);
writePng(join(frames, 'hero_blur.png'), blurred);
writePng(join(frames, 'hero_detail.png'), detail);
writePng(join(frames, 'hero_sharp.png'), sharpened);

// The magnified window itself, at native 16×16 — the reel blows this up with
// nearest-neighbour sampling so the pixels stay square and countable.
writePng(join(frames, 'crop.png'), cut(hero, CROP_X, CROP_Y, CROP_SIZE));
writePng(join(frames, 'crop_bright.png'), cut(bright, CROP_X, CROP_Y, CROP_SIZE));
writePng(join(frames, 'crop_sharp.png'), cut(sharpened, CROP_X, CROP_Y, CROP_SIZE));
writePng(join(frames, 'crop_blur.png'), cut(blurred, CROP_X, CROP_Y, CROP_SIZE));

// --- The magnified window: real addresses, real values ---------------------
const cells = [];
for (let row = 0; row < CROP_SIZE; row += 1) {
  for (let col = 0; col < CROP_SIZE; col += 1) {
    const x = CROP_X + col;
    const y = CROP_Y + row;
    const before = pixelAt(hero, x, y);
    const afterBright = pixelAt(bright, x, y);
    const afterSharp = pixelAt(sharpened, x, y);
    const blur = pixelAt(blurred, x, y);
    cells.push({
      x,
      y,
      before,
      bright: afterBright,
      sharp: afterSharp,
      blur,
      detail: {
        r: before.r - blur.r,
        g: before.g - blur.g,
        b: before.b - blur.b,
        luma: before.luma - blur.luma,
      },
    });
  }
}

// The probe pixel: a cell with a strong, *readable* detail value that does not
// clip — the arithmetic on the maths card is then exactly the app's maths.
const probe = cells.reduce((best, cell) => {
  const ok = cell.detail.luma >= 10 && cell.sharp.luma < 250 && cell.sharp.luma > 5;
  const bestOk = best.detail.luma >= 10 && best.sharp.luma < 250 && best.sharp.luma > 5;
  if (!ok) return best;
  if (!bestOk) return cell;
  return cell.detail.luma > best.detail.luma ? cell : best;
});

// The halo cell: the strongest detail in the window — it is the one that
// overshoots and clips, which is exactly what too much sharpening does.
const halo = cells.reduce((best, cell) =>
  Math.abs(cell.detail.luma) > Math.abs(best.detail.luma) ? cell : best,
);

// The brightness story pixel: the darkest cell inside the window, so the
// "+40" move is visible as a number change.
const darkest = cells.reduce((best, cell) => (cell.before.luma < best.before.luma ? cell : best));
const brightest = cells.reduce((best, cell) => (cell.before.luma > best.before.luma ? cell : best));

const data = {
  photo: {
    width: hero.width,
    height: hero.height,
    title: 'Ant on a golden club',
    author: 'Rhododendrites',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Ant_on_golden_club_(24749).jpg',
  },
  params: {
    brightness: BRIGHT_AMOUNT,
    contrast: CONTRAST_AMOUNT,
    sharpen: SHARP_AMOUNT,
    sigma: SHARP_RADIUS,
  },
  crop: { x: CROP_X, y: CROP_Y, size: CROP_SIZE, cells },
  probe,
  halo,
  darkest,
  brightest,
  histo: {
    original: histogram(hero),
    bright: histogram(bright),
    sharp: histogram(sharpened),
  },
};

writeFileSync(join(frames, 'data.json'), JSON.stringify(data, null, 2));

console.log('assets written to', frames);
console.log('probe', probe.x, probe.y, probe.before, '→', probe.sharp);
console.log('darkest', darkest.x, darkest.y, darkest.before, '→', darkest.bright);
