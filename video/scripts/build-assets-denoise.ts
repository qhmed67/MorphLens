/**
 * build-assets-denoise.ts — bake the denoise reel's assets from the app engine.
 *
 * Same rules as `build-assets.ts`: every number in the reel is produced by the
 * MorphLens engine (`src/engine/**`), never typed in by hand.
 *
 *   hero.png          the source photo (960×1200)
 *   noisy.png         salt & pepper, p = 0.05, seed 7 (the app's Trace uses
 *                     the same seed and probability)
 *   median.png        median 3×3 — the outlier-immune filter
 *   mean.png          mean 3×3 — the filter that smears the edges
 *   *_crop.png        the 3×3 window itself, magnified (one cell = one pixel)
 *   denoise.json      the 3×3 neighbourhood, the metrics, the histograms
 *
 * Run: npm run assets:denoise
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import { meanFilter } from '../../src/engine/noise/denoise';
import { medianFilter } from '../../src/engine/noise/denoise';
import { noiseSaltPepper } from '../../src/engine/noise/generate';
import { mse, psnr, ssim } from '../../src/engine/noise/metrics';
import { luma } from '../../src/engine/color/spaces';
import type { ImageBuffer } from '../../src/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'frames', 'denoise');
const { mkdirSync } = require('node:fs') as typeof import('node:fs');
mkdirSync(out, { recursive: true });

const PROBABILITY = 0.05;
const SEED = 7;
const WINDOW = 3;

function readPng(path: string): ImageBuffer {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

function writePng(path: string, buffer: ImageBuffer): void {
  const png = new PNG({ width: buffer.width, height: buffer.height });
  png.data = Buffer.from(buffer.data);
  writeFileSync(path, PNG.sync.write(png));
}

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

function lumaAt(buffer: ImageBuffer, x: number, y: number): number {
  const o = (y * buffer.width + x) * 4;
  return Math.round(luma(buffer.data[o], buffer.data[o + 1], buffer.data[o + 2]));
}

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

const hero = readPng(join(here, '..', 'public', 'frames', 'hero.png'));
const noisy = noiseSaltPepper(hero, { probability: PROBABILITY, seed: SEED });
const median = medianFilter(noisy, { k: WINDOW });
const mean = meanFilter(noisy, { k: WINDOW });

writePng(join(out, 'hero.png'), hero);
writePng(join(out, 'noisy.png'), noisy);
writePng(join(out, 'median.png'), median);
writePng(join(out, 'mean.png'), mean);

// --- the salt pixel the reel zooms into -------------------------------------
// Find a salt (or pepper) pixel close to the ant, so the story happens on the
// subject rather than on empty sky.
let best: { x: number; y: number; score: number } | null = null;
for (let y = 200; y < 700; y += 1) {
  for (let x = 300; x < 700; x += 1) {
    const v = noisy.data[(y * noisy.width + x) * 4];
    if (v !== 0 && v !== 255) continue;
    // prefer a pixel that is on the subject (not the flat sky)
    const clean = lumaAt(hero, x, y);
    const score = Math.abs(clean - 128) + (v === 0 ? 10 : 0);
    if (!best || score > best.score) best = { x, y, score };
  }
}
const salt = best ?? { x: 400, y: 400, score: 0 };

// The crop is exactly the 3×3 window, so one magnified cell IS one pixel and
// every number sits on the pixel it describes.
const CROP = 3;
const cropX = Math.max(0, Math.min(hero.width - CROP, salt.x - 1));
const cropY = Math.max(0, Math.min(hero.height - CROP, salt.y - 1));

writePng(join(out, 'noisy_crop.png'), cut(noisy, cropX, cropY, CROP));
writePng(join(out, 'median_crop.png'), cut(median, cropX, cropY, CROP));
writePng(join(out, 'hero_crop.png'), cut(hero, cropX, cropY, CROP));

// --- the 3×3 neighbourhood, the median and the mean ------------------------
const half = (WINDOW - 1) / 2;
const neighbourhood: { x: number; y: number; value: number; outlier: boolean }[] = [];
for (let dy = -half; dy <= half; dy += 1) {
  for (let dx = -half; dx <= half; dx += 1) {
    const x = salt.x + dx;
    const y = salt.y + dy;
    const value = lumaAt(noisy, x, y);
    neighbourhood.push({ x, y, value, outlier: value === 0 || value === 255 });
  }
}
const values = neighbourhood.map((n) => n.value).sort((a, b) => a - b);
const medianValue = values[Math.floor(values.length / 2)];
const meanValue = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

// how many salt & pepper pixels the noise actually put in
let pepper = 0;
let saltCount = 0;
for (let i = 0; i < noisy.data.length; i += 4) {
  if (noisy.data[i] === 0) pepper += 1;
  else if (noisy.data[i] === 255) saltCount += 1;
}

const metrics = {
  noisy: { psnr: psnr(noisy, hero), ssim: ssim(noisy, hero), mse: mse(noisy, hero) },
  median: { psnr: psnr(median, hero), ssim: ssim(median, hero), mse: mse(median, hero) },
  mean: { psnr: psnr(mean, hero), ssim: ssim(mean, hero), mse: mse(mean, hero) },
};

const data = {
  photo: { width: hero.width, height: hero.height },
  params: { probability: PROBABILITY, seed: SEED, window: WINDOW },
  saltPixel: { x: salt.x, y: salt.y, cropX, cropY, crop: CROP },
  neighbourhood,
  medianValue,
  meanValue,
  outliers: pepper + saltCount,
  pepper,
  saltCount,
  metrics,
  histo: { hero: histogram(hero), noisy: histogram(noisy), median: histogram(median) },
};

writeFileSync(join(out, 'denoise.json'), JSON.stringify(data, null, 2));

console.log('denoise assets →', out);
console.log('salt pixel', salt.x, salt.y, '| median', medianValue, '| mean', meanValue);
console.log('outliers', pepper + saltCount, 'of', hero.width * hero.height);
console.log('psnr', {
  noisy: metrics.noisy.psnr.toFixed(2),
  median: metrics.median.psnr.toFixed(2),
  mean: metrics.mean.psnr.toFixed(2),
});
console.log('ssim', {
  noisy: metrics.noisy.ssim.toFixed(3),
  median: metrics.median.ssim.toFixed(3),
  mean: metrics.mean.ssim.toFixed(3),
});
