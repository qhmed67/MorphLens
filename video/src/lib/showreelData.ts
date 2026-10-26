/**
 * showreelData.ts — the baked numbers of the modern showreel.
 */
import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

export type Matrix = {
  cols: number;
  rows: number;
  x: number;
  y: number;
  before: number[];
  after: number[];
};

export type PhotoInfo = {
  file: string;
  op: 'brightness' | 'contrast' | 'sharpen';
  amount: number;
  credit: string;
  width: number;
  height: number;
  histo: { before: number[]; after: number[] };
  peak: number;
};

export type ShowreelData = {
  photos: Record<string, PhotoInfo>;
  matrix: Record<string, Matrix>;
};

let cache: Promise<ShowreelData> | null = null;

export function loadShowreelData(): Promise<ShowreelData> {
  if (!cache) {
    cache = fetch(staticFile('frames/showreel/showreel.json')).then(
      (res) => res.json() as Promise<ShowreelData>,
    );
  }
  return cache;
}

export function useShowreelData(): ShowreelData | null {
  const [handle] = useState(() => delayRender('Showreel data'));
  const [data, setData] = useState<ShowreelData | null>(null);
  useEffect(() => {
    let alive = true;
    loadShowreelData().then((loaded) => {
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
