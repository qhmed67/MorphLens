/**
 * Pixels.tsx — the zoom-in.
 *
 * The camera keeps pushing towards the ant's leg while the 16×16 window
 * opens over it; the values type in cell by cell and one cell is singled out.
 * The window is a card, the way every visual in the house style is a card.
 */
import React from 'react';
import { interpolate, useCurrentFrame, staticFile } from 'remotion';
import { color, radius, safe } from '../styles/tokens';
import { CaptionBlock, FloatCard, PillTag, Sfx } from '../components/Chrome';
import { PixelWindow } from '../components/Graphics';
import { BrandMark, PhotoLayer, cameraForCard, pointOn, SceneFrame } from './SceneFrame';
import { useData } from '../lib/data';

const CARD_W = 840;
const CARD_H = 1060;
const CARD_LEFT = 540 - CARD_W / 2;
const CARD_TOP = 250;

export const Pixels: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useData();

  // Push in on the leg, then pull back out to reveal the ant again.
  const pushIn = interpolate(frame, [0, 130], [1, 1.75], { extrapolateRight: 'clamp' });
  const pullOut = interpolate(frame, [300, duration], [1.75, 1.08], { extrapolateRight: 'clamp' });
  const camera = { scale: frame < 300 ? pushIn : pullOut, x: 0, y: 0, originX: 42, originY: 40 };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);
  const leg = pointOn(data ? data.crop.x + 8 : 414, data ? data.crop.y + 8 : 458, fitted);

  const size = 620;
  const revealed = Math.round(
    interpolate(frame, [80, 180], [0, 256], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );
  const showHighlight = frame > 190;

  const tickFrames = [];
  for (let f = 82; f < 182; f += 5) tickFrames.push(f);

  return (
    <SceneFrame duration={duration}>
      <BrandMark delay={2} />

      {/* the photo card behind, with the camera still moving */}
      <FloatCard
        width={CARD_W}
        height={CARD_H}
        delay={0}
        tilt={1.5}
        flat
        style={{ left: CARD_LEFT, top: CARD_TOP }}
      >
        <PhotoLayer src={staticFile('frames/hero.png')} camera={fitted} veil={0.4} />
      </FloatCard>

      {/* the magnified window, on top of the photo card */}
      {data ? (
        <div style={{ position: 'absolute', left: leg.x - size / 2, top: leg.y - size / 2 }}>
          <FloatCard width={size} height={size} delay={10} tilt={-1.5} style={{ left: 0, top: 0 }}>
            <PixelWindow
              src={staticFile('frames/crop.png')}
              size={size}
              cells={data.crop.cells}
              cropX={data.crop.x}
              cropY={data.crop.y}
              revealed={revealed}
              delay={18}
              showAddresses={frame > 110}
              highlight={
                showHighlight
                  ? {
                      x: data.darkest.x,
                      y: data.darkest.y,
                      label: `(${data.darkest.x}, ${data.darkest.y})  ${data.darkest.before.r} · ${data.darkest.before.g} · ${data.darkest.before.b}`,
                    }
                  : null
              }
            />
          </FloatCard>
        </div>
      ) : null}

      <div style={{ position: 'absolute', left: CARD_LEFT + 26, top: CARD_TOP + 26 }}>
        <PillTag variant="badge" delay={20}>
          16
        </PillTag>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1400 }}>
        <CaptionBlock
          title={[{ text: 'كبّرنا ' }, { text: '16×16', accent: true }, { text: ' بكسل' }]}
          sub="كل مربع: عنوان وثلاثة أرقام من 0 لـ255."
          delay={30}
          width={936}
        />
      </div>

      <Sfx name="zoomin" at={0} volume={0.28} />
      {tickFrames.map((f) => (
        <Sfx key={f} name="ratchet" at={f} volume={0.15} />
      ))}
      <Sfx name="pop" at={190} volume={0.4} />
      <Sfx name="zoomout" at={300} volume={0.28} />
    </SceneFrame>
  );
};
