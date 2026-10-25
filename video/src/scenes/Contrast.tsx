/**
 * Contrast.tsx — step 02 of 03.
 *
 * The camera pulls all the way back to the whole plant and drifts across the
 * frame, while the transfer curve draws itself against the identity diagonal.
 */
import React from 'react';
import { interpolate, useCurrentFrame, staticFile } from 'remotion';
import { color, font, radius, safe } from '../styles/tokens';
import { CaptionBlock, FloatCard, MonoValue, Sfx, StepCounter } from '../components/Chrome';
import { TransferCurve } from '../components/Graphics';
import { BrandMark, PhotoLayer, cameraForCard, SceneFrame } from './SceneFrame';
import { useData } from '../lib/data';

const CARD_W = 840;
const CARD_H = 1060;
const CARD_LEFT = 540 - CARD_W / 2;
const CARD_TOP = 250;

export const Contrast: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useData();
  const c = data ? data.params.contrast : 1.3;

  // Pull back to the whole plant, then drift.
  const pullBack = interpolate(frame, [0, 90], [1.18, 1.0], { extrapolateRight: 'clamp' });
  const punch = interpolate(frame, [120, 180], [0, 0.14], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const camera = {
    scale: pullBack + punch,
    x: interpolate(frame, [90, duration], [-40, 60], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [90, duration], [-60, 40], { extrapolateRight: 'clamp' }),
    originX: 50,
    originY: 50,
  };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);

  const change = interpolate(frame, [120, 195], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inLevel = data ? data.darkest.before.luma : 36;

  const live = 1 + (c - 1) * change;
  const map = (v: number) => Math.max(0, Math.min(255, (v - 128) * live + 128));

  return (
    <SceneFrame duration={duration}>
      <BrandMark delay={2} />
      <StepCounter step={2} total={3} name="التباين" delay={6} />

      <FloatCard
        width={CARD_W}
        height={CARD_H}
        delay={0}
        tilt={1.5}
        style={{ left: CARD_LEFT, top: CARD_TOP }}
      >
        <PhotoLayer src={staticFile('frames/hero.png')} camera={fitted} veil={0.1} />
        <div style={{ position: 'absolute', inset: 0, opacity: change }}>
          <PhotoLayer src={staticFile('frames/hero_contrast.png')} camera={fitted} />
        </div>
      </FloatCard>

      {/* the curve card, overlapping the photo card like the references stack */}
      <div style={{ position: 'absolute', left: CARD_LEFT - 40, top: 830 }}>
        <FloatCard width={660} height={520} delay={26} tilt={-2}>
          <div style={{ position: 'absolute', left: 26, top: 24 }}>
            <TransferCurve
              map={map}
              width={580}
              height={420}
              delay={30}
              marker={{ input: inLevel, label: `${inLevel}` }}
            />
          </div>
          <div style={{ position: 'absolute', right: 20, bottom: 16 }}>
            <MonoValue delay={40} tone="paper" style={{ fontSize: 21, lineHeight: '30px' }}>
              out = (in − 128)·c + 128
            </MonoValue>
          </div>
        </FloatCard>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1400 }}>
        <CaptionBlock
          title={[{ text: 'ال' }, { text: 'تباين', accent: true }, { text: ': الوسط ما بيتحركش' }]}
          sub="الرمادي 128 بيفضل ثابت — والباقي بيبعد عنه."
          delay={120}
          width={936}
          size={52}
        />
      </div>

      <Sfx name="zoomout" at={0} volume={0.3} />
      <Sfx name="sweep" at={30} volume={0.36} />
      <Sfx name="zoomin" at={120} volume={0.3} />
    </SceneFrame>
  );
};
