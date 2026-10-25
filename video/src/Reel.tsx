/**
 * Reel.tsx — the composition: six scenes, ~60 seconds, 1080×1920.
 *
 * Scene boundaries overlap by 24 frames — twice the 14-frame fade — so the
 * outgoing scene is already fading out while the incoming one fades in.
 * With a shorter overlap there is a single frame where both are invisible,
 * which reads as a white flash between the modes.
 */
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { useFonts } from './styles/fonts';
import { Hook } from './scenes/Hook';
import { Pixels } from './scenes/Pixels';
import { Brightness } from './scenes/Brightness';
import { Contrast } from './scenes/Contrast';
import { Sharpen } from './scenes/Sharpen';
import { Outro } from './scenes/Outro';

const OVERLAP = 24;

type Scene = {
  key: string;
  duration: number;
  render: (props: { duration: number }) => React.ReactNode;
};

const SCENES: Scene[] = [
  { key: 'hook', duration: 135, render: (p) => <Hook {...p} /> },
  { key: 'pixels', duration: 317, render: (p) => <Pixels {...p} /> },
  { key: 'brightness', duration: 452, render: (p) => <Brightness {...p} /> },
  { key: 'contrast', duration: 282, render: (p) => <Contrast {...p} /> },
  { key: 'sharpen', duration: 492, render: (p) => <Sharpen {...p} /> },
  { key: 'outro', duration: 250, render: (p) => <Outro {...p} /> },
];

/** Start frame of every scene, each one overlapping the previous. */
const STARTS: number[] = [];
let cursor = 0;
for (const scene of SCENES) {
  STARTS.push(cursor);
  cursor += scene.duration - OVERLAP;
}

/** Total length of the composition (the last scene's end frame). */
export const REEL_DURATION =
  STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].duration;

export const Reel: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill>
      {/* The paper tone lives behind the whole reel: the scene fades then
          reveal paper, never the black of an empty canvas. */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg,#FBFAF7 0%,#EFEEE9 100%)' }} />
      {SCENES.map((scene, index) => (
        <Sequence
          key={scene.key}
          from={STARTS[index]}
          durationInFrames={scene.duration}
          name={scene.key}
        >
          {scene.render({ duration: scene.duration })}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
