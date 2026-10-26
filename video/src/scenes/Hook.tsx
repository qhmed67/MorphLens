/**
 * Hook.tsx — the opening.
 *
 * A dark chapter card (the references open their sections this way), then the
 * photo arrives in a card while the camera pushes in on the ant.
 */
import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { color, radius, safe } from '../styles/tokens';
import { CaptionBlock, ChapterCard, FloatCard, Sfx } from '../components/Chrome';
import { BrandMark, PhotoLayer, cameraForCard, SceneFrame } from './SceneFrame';
import { useData } from '../lib/data';

const CARD_W = 780;
const CARD_H = 980;
const CARD_LEFT = 540 - CARD_W / 2;
const CARD_TOP = 330;

export const Hook: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useData();

  // The camera pushes in on the ant for the whole scene.
  const camera = {
    scale: interpolate(frame, [40, duration], [1, 1.34], { extrapolateRight: 'clamp' }),
    x: interpolate(frame, [40, duration], [0, 18], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [40, duration], [0, -14], { extrapolateRight: 'clamp' }),
    originX: 51,
    originY: 25,
  };

  return (
    <SceneFrame duration={duration} fade={12} fadeIn={0}>
      <BrandMark delay={2} />

      <ChapterCard en="MORPHLENS" ar="مختبر الصور" delay={4} hold={54} />

      <FloatCard
        width={CARD_W}
        height={CARD_H}
        delay={44}
        tilt={-2}
        onExit={duration - 12}
        style={{ left: CARD_LEFT, top: CARD_TOP }}
      >
        <PhotoLayer
          src={staticFile('frames/hero.png')}
          camera={cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera)}
        />
      </FloatCard>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: CARD_TOP + CARD_H + 46 }}>
        <CaptionBlock
          title={[{ text: 'كل صورة ' }, { text: 'أرقام', accent: true }]}
          sub="مش ألوان — كل بكسل له عنوان وثلاثة أرقام."
          delay={58}
          width={936}
        />
      </div>

      <Sfx name="sweep" at={4} volume={0.3} />
      <Sfx name="whoosh" at={44} volume={0.34} />
    </SceneFrame>
  );
};
