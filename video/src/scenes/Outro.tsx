/**
 * Outro.tsx — the end card.
 *
 * The way the references end: a big headline with the keyword in guillemets
 * and the accent, a dark pill button, and the brand mark.
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { color, font, radius, safe, space } from '../styles/tokens';
import { FloatCard, Sfx, Sunburst } from '../components/Chrome';
import { BrandMark, PhotoLayer, cameraForCard, SceneFrame } from './SceneFrame';

const CARD_W = 840;
const CARD_H = 1060;
const CARD_LEFT = 540 - CARD_W / 2;
const CARD_TOP = 250;

export const Outro: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The photo keeps drifting behind the end card — the frame is never static.
  const camera = {
    scale: interpolate(frame, [0, duration], [1.0, 1.12], { extrapolateRight: 'clamp' }),
    x: interpolate(frame, [0, duration], [0, 40], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [0, duration], [0, -30], { extrapolateRight: 'clamp' }),
    originX: 51,
    originY: 30,
  };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);

  const cta = spring({ frame: frame - 40, fps, config: { damping: 22, stiffness: 170 } });

  return (
    <SceneFrame duration={duration}>
      <BrandMark delay={2} />

      <FloatCard
        width={CARD_W}
        height={CARD_H}
        delay={6}
        tilt={-1.5}
        style={{ left: CARD_LEFT, top: CARD_TOP }}
      >
        <PhotoLayer src={staticFile('frames/hero.png')} camera={fitted} veil={0.16} />
      </FloatCard>

      <div style={{ position: 'absolute', left: CARD_LEFT + 30, top: CARD_TOP + 30 }}>
        <Sunburst size={54} delay={10} />
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1400 }}>
        <div
          style={{
            direction: 'rtl',
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 58,
            lineHeight: '78px',
            color: color.ink,
            textAlign: 'center',
            opacity: cta,
            transform: `translateY(${(1 - cta) * 22}px)`,
          }}
        >
          اكتب <span style={{ color: color.accent }}>«PHOTO»</span>
          <br />
          في التعليقات
        </div>
        <div
          style={{
            marginTop: 26,
            display: 'flex',
            justifyContent: 'center',
            opacity: cta,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              height: 66,
              padding: '0 30px',
              borderRadius: radius.pill,
              background: color.chapter,
              color: color.onAccent,
              fontFamily: font.label,
              fontWeight: 600,
              fontSize: 26,
              boxShadow: '0 18px 40px rgba(20,18,12,0.28)',
            }}
          >
            MorphLens — مختبر الصور
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            textAlign: 'center',
            fontFamily: font.body,
            fontSize: 20,
            color: color.faint,
            opacity: interpolate(frame, [90, 120], [0, 1], { extrapolateLeft: 'clamp' }),
          }}
        >
          Photo: “Ant on a golden club” by Rhododendrites · CC BY-SA 4.0
        </div>
      </div>

      <Sfx name="pop" at={6} volume={0.34} />
      <Sfx name="click" at={40} volume={0.3} />
    </SceneFrame>
  );
};
