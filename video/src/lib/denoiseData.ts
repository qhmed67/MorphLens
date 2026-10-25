/**
 * denoiseData.ts — the baked numbers of the denoise reel.
 *
 * `public/frames/denoise/denoise.json` is produced by
 * `scripts/build-assets-denoise.ts`, which runs the app's own engine
 * (salt & pepper noise, median filter, mean filter, PSNR/SSIM) over the
 * source photo.
 */
import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

export type Neighbour = { x: number; y: number; value: number; outlier: boolean };

export type Metrics = { psnr: number; ssim: number; mse: number };

export type DenoiseData = {
  photo: { width: number; height: number };
  params: { probability: number; seed: number; window: number };
  saltPixel: { x: number; y: number; cropX: number; cropY: number; crop: number };
  neighbourhood: Neighbour[];
  medianValue: number;
  meanValue: number;
  outliers: number;
  pepper: number;
  saltCount: number;
  metrics: { noisy: Metrics; median: Metrics; mean: Metrics };
  histo: { hero: number[]; noisy: number[]; median: number[] };
};

let cache: Promise<DenoiseData> | null = null;

export function loadDenoiseData(): Promise<DenoiseData> {
  if (!cache) {
    cache = fetch(staticFile('frames/denoise/denoise.json')).then(
      (res) => res.json() as Promise<DenoiseData>,
    );
  }
  return cache;
}

/** Hook version: holds the render until the data is in memory. */
export function useDenoiseData(): DenoiseData | null {
  const [handle] = useState(() => delayRender('Denoise data'));
  const [data, setData] = useState<DenoiseData | null>(null);
  useEffect(() => {
    let alive = true;
    loadDenoiseData().then((loaded) => {
      if (!alive) return;
      setData(loaded);
      continueRender(handle);
    });
    return () => {
      alive = false;
    };
  }, [handle]);
  return data;
}
