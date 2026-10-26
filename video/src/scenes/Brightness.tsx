/**
 * Brightness.tsx — step 01 of 03.
 *
 * The value that lives in the pixel cell travels out of the window, an arrow
 * carries it through `+40`, and the result lands next to it. Then the picture
 * changes and the histogram moves with it.
 */
import React from 'react';
import { interpolate, useCurrentFrame, staticFile } from 'remotion';
import { color, font, radius, safe } from '../styles/tokens';
import {
  CaptionBlock,
  CountingNumber,
  FloatCard,
  MonoValue,
  Sfx,
  StepCounter,
} from '../components/Chrome';
import { Arrow, Histogram, PixelWindow } from '../components/Graphics';
import { BrandMark, PhotoLayer, cameraForCard, SceneFrame } from './SceneFrame';
import { useData } from '../lib/data';

const CARD_W = 840;
const CARD_H = 1080;
const CARD_LEFT = 540 - CARD_W / 2;
const CARD_TOP = 250;

export const Brightness: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useData();
  const amount = data ? data.params.brightness : 40;

  // The camera drifts down the stem while the picture slowly opens up.
  const base = interpolate(frame, [0, duration], [1, 1.28], { extrapolateRight: 'clamp' });
  const punch = interpolate(frame, [210, 280], [0, 0.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const camera = {
    scale: base + punch,
    x: interpolate(frame, [0, duration], [10, -30], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [0, duration], [60, -110], { extrapolateRight: 'clamp' }),
    originX: 54,
    originY: 58,
  };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);

  const change = interpolate(frame, [210, 280], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bins = (data?.histo.original ?? []).map(
    (v, i) => v + ((data?.histo.bright[i] ?? v) - v) * change,
  );

  const inR = data ? data.darkest.before.r : 77;
  const outR = data ? data.darkest.bright.r : 117;

  // Where the highlighted cell sits inside the 420 px window.
  const cellX = safe.side + ((data ? data.darkest.x - data.crop.x : 6) + 0.5) * (420 / 16);
  const cellY = 430 + ((data ? data.darkest.y - data.crop.y : 5) + 0.5) * (420 / 16);

  return (
    <SceneFrame duration={duration}>
      <BrandMark delay={2} />
      <StepCounter step={1} total={3} name="السطوع" delay={6} />

      {/* the photo card, and the picture changing inside it */}
      <FloatCard
        width={CARD_W}
        height={CARD_H}
        delay={0}
        tilt={-1.5}
        style={{ left: CARD_LEFT, top: CARD_TOP }}
      >
        <PhotoLayer src={staticFile('frames/hero.png')} camera={fitted} veil={0.08} />
        <div style={{ position: 'absolute', inset: 0, opacity: change }}>
          <PhotoLayer src={staticFile('frames/hero_bright.png')} camera={fitted} />
        </div>
      </FloatCard>

      {/* the magnified window card */}
      {data ? (
        <div style={{ position: 'absolute', left: safe.side, top: 430 }}>
          <FloatCard width={420} height={420} delay={18} tilt={2} style={{ left: 0, top: 0 }}>
            <PixelWindow
              src={staticFile('frames/crop.png')}
              size={420}
              cells={data.crop.cells}
              cropX={data.crop.x}
              cropY={data.crop.y}
              revealed={256}
              delay={26}
              highlight={{ x: data.darkest.x, y: data.darkest.y }}
            />
          </FloatCard>
        </div>
      ) : null}

      {/* the arithmetic */}
      <div style={{ position: 'absolute', left: 706, top: 470 }}>
        <MonoValue delay={70} tone="paper">
          R {inR}
        </MonoValue>
        <div style={{ height: 12 }} />
        <MonoValue delay={86} tone="accent">
          + {amount}
        </MonoValue>
        <div style={{ height: 12 }} />
        <MonoValue delay={102} tone="ink">
          R <CountingNumber from={inR} to={outR} delay={104} format={(v) => String(Math.round(v))} />
        </MonoValue>
      </div>

      <Arrow
        from={{ x: cellX + 150, y: cellY }}
        to={{ x: 700, y: 600 }}
        delay={118}
        label={`+${amount}`}
        bend={40}
      />

      {/* the histogram card */}
      {frame > 250 ? (
        <div style={{ position: 'absolute', left: 40, top: 1160 }}>
          <FloatCard width={560} height={230} delay={250} tilt={-1} flat>
            <div style={{ padding: '22px 24px 14px' }}>
              <Histogram bins={bins} width={512} height={170} delay={0} />
            </div>
          </FloatCard>
        </div>
      ) : null}

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1490 }}>
        <CaptionBlock
          title={[{ text: 'ال' }, { text: 'سطوع', accent: true }, { text: ': رقم واحد على كل بكسل' }]}
          sub={`${inR} + ${amount} = ${outR} — نفس القدر على الصورة كلها.`}
          delay={140}
          width={936}
          size={52}
        />
      </div>

      <Sfx name="click" at={4} volume={0.34} />
      <Sfx name="pop" at={70} volume={0.32} />
      <Sfx name="pop" at={102} volume={0.42} />
      <Sfx name="zoomin" at={210} volume={0.36} />
      <Sfx name="whoosh" at={250} volume={0.3} />
    </SceneFrame>
  );
};
