/**
 * ShowreelTimeline.tsx — the modern showreel's cut list.
 *
 * Seven short shots, each a different framing of a different photograph.
 */
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { useFonts } from './styles/fonts';
import { ShotFlash } from './components/Modern';
import { FrameBreak } from './effects';
import {
  ShowBrightness,
  ShowContrast,
  ShowNumbers,
  ShowOutro,
  ShowSharpen,
  ShowTitle,
  ShowTriptych,
} from './scenes/Showreel';

const OVERLAP = 15;

type Shot = {
  key: string;
  duration: number;
  render: (props: { duration: number }) => React.ReactNode;
};

const SHOTS: Shot[] = [
  { key: 'title', duration: 105, render: (p) => <ShowTitle {...p} /> },
  { key: 'brightness', duration: 195, render: (p) => <ShowBrightness {...p} /> },
  { key: 'numbers', duration: 180, render: (p) => <ShowNumbers {...p} /> },
  { key: 'contrast', duration: 165, render: (p) => <ShowContrast {...p} /> },
  { key: 'sharpen', duration: 225, render: (p) => <ShowSharpen {...p} /> },
  { key: 'triptych', duration: 195, render: (p) => <ShowTriptych {...p} /> },
  { key: 'outro', duration: 180, render: (p) => <ShowOutro {...p} /> },
];

const STARTS: number[] = [];
let cursor = 0;
for (const shot of SHOTS) {
  STARTS.push(cursor);
  cursor += shot.duration - OVERLAP;
}

export const SHOWREEL_DURATION = STARTS[STARTS.length - 1] + SHOTS[SHOTS.length - 1].duration;

export const Showreel: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: '#EFEDE4' }} />
      {SHOTS.map((shot, index) => (
        <Sequence
          key={shot.key}
          from={STARTS[index]}
          durationInFrames={shot.duration}
          name={`show:${shot.key}`}
        >
          {/* 17 — Frame Break: the shot arrives in pieces (a shatter cut) */}
          <FrameBreak delay={0} duration={16} cols={4} rows={6}>
            {shot.render({ duration: shot.duration })}
          </FrameBreak>
          <ShotFlash />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
