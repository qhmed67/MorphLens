/**
 * Sharpen.tsx — step 03 of 03.
 *
 * The camera pushes into the ant's head, a 3×3 window slides over the
 * magnified pixels, and the real pipeline is staged on the photo
 * (original → low-pass → detail → sharpened). A tag names the stage as it
 * passes, and the arithmetic arrives one line at a time.
 */
import React from 'react';
import { interpolate, useCurrentFrame, staticFile } from 'remotion';
import { color, font, radius, safe } from '../styles/tokens';
import { CaptionBlock, FloatCard, MonoValue, Sfx, StepCounter } from '../components/Chrome';
import { KernelWindow, PixelWindow } from '../components/Graphics';
import { BrandMark, PhotoLayer, cameraForCard, pointOn, SceneFrame } from './SceneFrame';
import { useData } from '../lib/data';

const CARD_W = 840;
const CARD_H = 1060;
const CARD_LEFT = 540 - CARD_W / 2;
const CARD_TOP = 250;

const STAGES = [
  { src: 'frames/hero.png', name: 'الأصل' },
  { src: 'frames/hero_blur.png', name: 'ناعم' },
  { src: 'frames/hero_detail.png', name: 'التفاصيل' },
  { src: 'frames/hero_sharp.png', name: 'الحدّة' },
];

export const Sharpen: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useData();

  // Push into the ant's head, then pull back out.
  const pushIn = interpolate(frame, [0, 140], [1, 1.38], { extrapolateRight: 'clamp' });
  const pullOut = interpolate(frame, [360, duration], [1.38, 1.0], { extrapolateRight: 'clamp' });
  const camera = {
    scale: frame < 360 ? pushIn : pullOut,
    x: interpolate(frame, [0, 140], [0, 30], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [0, 140], [0, -40], { extrapolateRight: 'clamp' }),
    originX: 51,
    originY: 24,
  };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);

  // One shared stage position drives the cross-fade, exactly like the app's
  // Trace screen: opacityᵢ = clamp(1 − |pos − i|, 0, 1).
  const pos = interpolate(frame, [150, 280], [0, 3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const probe = data?.probe;
  const inR = probe ? probe.before.r : 190;
  const blurR = probe ? probe.blur.r : 166;
  const detailR = probe ? probe.detail.r : 24;
  const outR = probe ? probe.sharp.r : 219;
  const amount = data ? data.params.sharpen : 1.2;

  const drift = interpolate(frame, [70, 150], [0, 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const leg = pointOn(data ? data.crop.x + 8 : 414, data ? data.crop.y + 8 : 458, fitted);

  return (
    <SceneFrame duration={duration}>
      <BrandMark delay={2} />
      <StepCounter step={3} total={3} name="الحدّة" delay={6} />

      <FloatCard
        width={CARD_W}
        height={CARD_H}
        delay={0}
        tilt={-1.5}
        style={{ left: CARD_LEFT, top: CARD_TOP }}
      >
        <PhotoLayer src={staticFile('frames/hero.png')} camera={fitted} veil={0.08} />
        {STAGES.map((s, index) => (
          <div
            key={s.src}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: interpolate(pos, [index - 1, index, index + 1], [0, 1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <PhotoLayer src={staticFile(s.src)} camera={fitted} />
          </div>
        ))}
      </FloatCard>

      {/* the stage tag, riding in and out with the stage it names */}
      {STAGES.map((s, index) => {
        const presence = interpolate(pos, [index - 0.5, index, index + 0.5], [0, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={s.name}
            style={{
              position: 'absolute',
              left: CARD_LEFT + 26,
              top: CARD_TOP + 26,
              padding: '10px 20px',
              borderRadius: radius.pill,
              background: color.chapter,
              color: color.onAccent,
              fontFamily: 'Rubik',
              fontWeight: 700,
              fontSize: 26,
              opacity: presence,
              transform: `translateX(${(1 - presence) * -24}px)`,
            }}
          >
            {s.name}
          </div>
        );
      })}

      {/* the magnified pixels + the sliding 3×3 window */}
      {data ? (
        <div style={{ position: 'absolute', left: leg.x - 200, top: leg.y - 200 }}>
          <FloatCard width={400} height={400} delay={24} tilt={2} style={{ left: 0, top: 0 }}>
            <PixelWindow
              src={staticFile('frames/crop.png')}
              size={400}
              cells={data.crop.cells}
              cropX={data.crop.x}
              cropY={data.crop.y}
              revealed={256}
              delay={30}
              textOpacity={interpolate(frame, [140, 180], [0.24, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
            />
            <div style={{ position: 'absolute', left: (drift % 1) * 133, top: 0 }}>
              <KernelWindow
                size={400}
                cell={133}
                delay={70}
                weight={[0.02, 0.06, 0.02, 0.06, 0.72, 0.06, 0.02, 0.06, 0.02]}
              />
            </div>
          </FloatCard>
        </div>
      ) : null}

      {/* the arithmetic, one line at a time */}
      <div style={{ position: 'absolute', left: safe.side, top: 1120 }}>
        <MonoValue delay={286} tone="paper">
          {inR} − {blurR} = {detailR}
        </MonoValue>
        <div style={{ height: 14 }} />
        <MonoValue delay={312} tone="ink">
          {inR} + {amount}×{detailR} = {outR}
        </MonoValue>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1420 }}>
        <CaptionBlock
          title={[{ text: 'ال' }, { text: 'حدّة', accent: true }, { text: ': الفرق بيرجع تاني' }]}
          sub="ننسخ الصورة، نعمل لها blur، ونطرح — واللي فاضل هو الحواف."
          delay={300}
          width={936}
          size={52}
        />
      </div>

      <Sfx name="zoomin" at={0} volume={0.3} />
      <Sfx name="click" at={70} volume={0.3} />
      <Sfx name="sweep" at={150} volume={0.32} />
      <Sfx name="sweep" at={194} volume={0.32} />
      <Sfx name="sweep" at={238} volume={0.32} />
      <Sfx name="pop" at={286} volume={0.34} />
      <Sfx name="pop" at={312} volume={0.4} />
      <Sfx name="zoomout" at={360} volume={0.3} />
    </SceneFrame>
  );
};
