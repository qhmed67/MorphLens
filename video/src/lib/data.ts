/**
 * data.ts — the baked numbers of the reel (real pixels, real engine output).
 *
 * `public/frames/data.json` is produced by `scripts/build-assets.ts`, which
 * runs the app's own engine (`src/engine/**`) over the source photo. Every
 * number that appears in the video comes from that file.
 */
import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

export type Pixel = { r: number; g: number; b: number; luma: number };

export type Cell = {
  x: number;
  y: number;
  before: Pixel;
  bright: Pixel;
  sharp: Pixel;
  blur: Pixel;
  detail: { r: number; g: number; b: number; luma: number };
};

export type ReelData = {
  photo: {
    width: number;
    height: number;
    title: string;
    author: string;
    license: string;
    source: string;
  };
  params: { brightness: number; contrast: number; sharpen: number; sigma: number };
  crop: { x: number; y: number; size: number; cells: Cell[] };
  probe: Cell;
  halo: Cell;
  darkest: Cell;
  brightest: Cell;
  histo: { original: number[]; bright: number[]; sharp: number[] };
};

let cache: Promise<ReelData> | null = null;

/** Fetch (and memoise) the baked data. */
export function loadData(): Promise<ReelData> {
  if (!cache) {
    cache = fetch(staticFile('frames/data.json')).then((res) => res.json() as Promise<ReelData>);
  }
  return cache;
}

/** Hook version: holds the render until the data is in memory. */
export function useData(): ReelData | null {
  const [handle] = useState(() => delayRender('Reel data'));
  const [data, setData] = useState<ReelData | null>(null);
  useEffect(() => {
    let alive = true;
    loadData().then((loaded) => {
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

/** Layout constants: how the 960×1440 source covers the 1080×1920 frame. */
export const photoCover = {
  width: 1280,
  height: 1920,
  left: -100,
  top: 0,
} as const;

/** Screen position of a source pixel (crop centre) on the full-bleed photo. */
export function screenOf(sourceX: number, sourceY: number): { x: number; y: number } {
  const s = photoCover.width / 960;
  return { x: sourceX * s + photoCover.left, y: sourceY * s + photoCover.top };
}
