/**
 * DenoiseReel.tsx — the second reel: the median filter, in the house style.
 */
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { useFonts } from './styles/fonts';
import { DenoiseChapter, DenoiseCompare, DenoiseEnd, DenoiseMedian } from './scenes/Denoise';

const OVERLAP = 24;

type Scene = {
  key: string;
  duration: number;
  render: (props: { duration: number }) => React.ReactNode;
};

const SCENES: Scene[] = [
  { key: 'chapter', duration: 210, render: (p) => <DenoiseChapter {...p} /> },
  { key: 'median', duration: 450, render: (p) => <DenoiseMedian {...p} /> },
  { key: 'compare', duration: 460, render: (p) => <DenoiseCompare {...p} /> },
  { key: 'end', duration: 416, render: (p) => <DenoiseEnd {...p} /> },
];

const STARTS: number[] = [];
let cursor = 0;
for (const scene of SCENES) {
  STARTS.push(cursor);
  cursor += scene.duration - OVERLAP;
}

export const DENOISE_DURATION = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].duration;

export const DenoiseReel: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: '#EFEDE4' }} />
      {SCENES.map((scene, index) => (
        <Sequence
          key={scene.key}
          from={STARTS[index]}
          durationInFrames={scene.duration}
          name={`denoise:${scene.key}`}
        >
          {scene.render({ duration: scene.duration })}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
