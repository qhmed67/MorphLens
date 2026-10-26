/**
 * Denoise.tsx — the second reel: the median filter.
 *
 * The story the app's Denoise Arena tells, in the house style: the picture
 * gets salt & pepper noise, a 3×3 window shows the nine neighbour values
 * around one bad pixel, the median picks the middle one and the outlier
 * disappears, and the metrics say how much that was worth.
 */
import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { color, font, radius, safe, space, type } from '../styles/tokens';
import {
  CaptionBlock,
  CountingNumber,
  FloatCard,
  MonoValue,
  Sfx,
  Sunburst,
} from '../components/Chrome';
import { PaperCutout, StudioReveal } from '../effects';
import { BrandMark, PhotoLayer, cameraForCard, SceneFrame } from './SceneFrame';
import { useDenoiseData } from '../lib/denoiseData';

/* ------------------------------------------------------------- chapter card */

export const DenoiseChapter: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useDenoiseData();

  const CARD_W = 840;
  const CARD_H = 1060;
  const CARD_LEFT = 540 - CARD_W / 2;
  const CARD_TOP = 250;

  // The camera drifts down the stem; the picture then gets the noise.
  const camera = {
    scale: interpolate(frame, [60, duration], [1, 1.22], { extrapolateRight: 'clamp' }),
    x: interpolate(frame, [60, duration], [0, 30], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [60, duration], [40, -40], { extrapolateRight: 'clamp' }),
    originX: 51,
    originY: 30,
  };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);
  const noiseIn = interpolate(frame, [96, 126], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <SceneFrame duration={duration} fade={12} fadeIn={0} motif={false} beats={[0, 44, 70, 96, 150]}>
      <BrandMark delay={2} />

      {/* 09 — Studio Reveal: the chapter card rolls off like a backdrop */}
      <StudioReveal
        delay={44}
        duration={20}
        style={{ position: 'absolute', left: CARD_LEFT, top: CARD_TOP, width: CARD_W, height: CARD_H }}
      >
        <FloatCard
          width={CARD_W}
          height={CARD_H}
          delay={60}
          tilt={-1.5}
          style={{ left: CARD_LEFT, top: CARD_TOP }}
        >
          <PhotoLayer src={staticFile('frames/denoise/hero.png')} camera={fitted} />
          <div style={{ position: 'absolute', inset: 0, opacity: noiseIn }}>
            <PhotoLayer src={staticFile('frames/denoise/noisy.png')} camera={fitted} />
          </div>
        </FloatCard>
      </StudioReveal>

      {/* the dark chapter card */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 450,
          top: 960 - 260,
          width: 900,
          height: 520,
          borderRadius: radius.lg,
          background: color.chapter,
          overflow: 'hidden',
          opacity: interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp' }) *
            interpolate(frame, [46, 62], [1, 0], { extrapolateLeft: 'clamp' }),
          transform: `scale(${interpolate(frame, [0, 20], [0.95, 1], { extrapolateLeft: 'clamp' })})`,
          boxShadow: '0 40px 90px rgba(20,18,12,0.35)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <Sunburst size={64} />
          <div
            style={{
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: 46,
              letterSpacing: 2,
              color: color.onAccent,
            }}
          >
            MEDIAN
          </div>
          <div style={{ direction: 'rtl', fontFamily: 'Rubik', fontWeight: 700, fontSize: 44, color: color.goodOnDark }}>
            الميديان
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1400 }}>
        <CaptionBlock
          title={[{ text: 'الصورة فيها ' }, { text: 'تشويش', tone: 'bad' }]}
          sub={
            data
              ? `${data.outliers.toLocaleString('en-US')} بكسل`
              : 'بكسلات عشوائية'
          }
          delay={70}
          width={936}
        />
      </div>

      <Sfx name="sweep" at={4} volume={0.3} />
      <Sfx name="whoosh" at={60} volume={0.3} />
      <Sfx name="thump" at={96} volume={0.34} />
    </SceneFrame>
  );
};

/* ------------------------------------------------------- the 3×3 neighbourhood */

export const DenoiseMedian: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useDenoiseData();

  const cell = 148;
  const gridSize = cell * 3;
  const gridLeft = 540 - gridSize / 2;
  const gridTop = 400;

  // The window opens, the numbers type in, then the median is picked.
  const open = spring({ frame: frame - 6, fps, config: { damping: 20, stiffness: 170 } });
  const typed = Math.round(
    interpolate(frame, [40, 96], [0, 9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );
  const sorted = interpolate(frame, [110, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const result = spring({ frame: frame - 150, fps, config: { damping: 18, stiffness: 200 } });

  const values = data ? data.neighbourhood.map((n) => n.value) : [];
  const sortedValues = [...values].sort((a, b) => a - b);
  const medianValue = data ? data.medianValue : 0;

  return (
    <SceneFrame duration={duration} motif={false} beats={[0, 40, 110, 150, 176, 214, 270, 330]}>
      <BrandMark delay={2} />

      {/* the magnified 9×9 crop, with the 3×3 values on top */}
      {data ? (
        <div style={{ position: 'absolute', left: gridLeft, top: gridTop }}>
          <FloatCard width={gridSize + 40} height={gridSize + 40} delay={0} tilt={2} style={{ left: 0, top: 0 }}>
            <div style={{ position: 'absolute', left: 20, top: 20 }}>
              <img
                src={staticFile('frames/denoise/noisy_crop.png')}
                style={{ width: gridSize, height: gridSize, imageRendering: 'pixelated', display: 'block' }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: 20,
                width: gridSize,
                height: gridSize,
                display: 'flex',
                flexWrap: 'wrap',
                flexDirection: 'row',
                alignContent: 'flex-start',
              }}
            >
              {data.neighbourhood.map((n, i) => {
                const shown = i < typed;
                const isOutlier = n.outlier;
                // the bad pixel is pulled out of the window and the cell
                // takes the median back — the whole point, shown, not said
                const leave = isOutlier
                  ? interpolate(frame, [168, 196], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing: Easing.in(Easing.cubic),
                    })
                  : 0;
                const repair = isOutlier
                  ? interpolate(frame, [200, 224], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })
                  : 0;
                return (
                  <div
                    key={`${n.x}-${n.y}`}
                    style={{
                      width: cell,
                      height: cell,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${
                        isOutlier && leave < 1
                          ? color.badOnDark
                          : repair > 0.5
                            ? color.goodOnDark
                            : 'rgba(255,255,255,0.35)'
                      }`,
                      background:
                        isOutlier && leave < 1
                          ? `rgba(255,130,114,${0.3 * (1 - leave)})`
                          : repair > 0
                            ? `rgba(63,207,142,${0.16 * repair})`
                            : 'rgba(20,20,18,0.28)',
                      color: '#FBFAF7',
                      fontFamily: 'JetBrains Mono',
                      fontSize: 30,
                      opacity: shown ? 1 - leave : 0,
                      transform: `scale(${(shown ? 1 : 0.7) * (1 - leave * 0.55)}) translate(${
                        leave * 210
                      }px, ${leave * -54}px) rotate(${leave * 16}deg)`,
                    }}
                  >
                    {leave > 0.62 ? medianValue : n.value}
                  </div>
                );
              })}
            </div>
          </FloatCard>
        </div>
      ) : null}

      {/* 11 — Paper Cutout: the nine neighbour values as paper slips */}
      {data ? (
        <div
          style={{
            position: 'absolute',
            left: safe.side,
            right: safe.side,
            top: 930,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <PaperCutout
            direction="row"
            mono
            width={920}
            delay={108}
            step={3}
            strips={sortedValues.map((v, i) => ({
              text: String(v),
              accent: i === Math.floor(sortedValues.length / 2),
            }))}
          />
        </div>
      ) : null}

      {/* the result */}
      {data ? (
        <div
          style={{
            position: 'absolute',
            left: 540 - 90,
            top: 1080,
            opacity: result,
            transform: `scale(${0.8 + 0.2 * result})`,
          }}
        >
          <MonoValue delay={150} tone="ink" style={{ fontSize: 40, lineHeight: '56px', padding: '12px 26px' }}>
            {medianValue}
          </MonoValue>
        </div>
      ) : null}

      {/* the counter that keeps working after the pick — motion for the hold */}
      {data ? (
        <div
          style={{
            position: 'absolute',
            left: safe.side,
            top: 420,
            width: 300,
            opacity: interpolate(frame, [214, 240], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div style={{ fontFamily: font.body, fontSize: 24, color: color.sub, direction: 'rtl' }}>
            بكسل نضّف
          </div>
          <div
            style={{
              fontFamily: font.mono,
              fontWeight: 700,
              fontSize: 66,
              lineHeight: '76px',
              color: color.good,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <CountingNumber
              from={0}
              to={data.outliers}
              delay={218}
              duration={64}
              format={(v) => Math.round(v).toLocaleString('en-US')}
            />
          </div>
          <div style={{ height: 5, borderRadius: 999, background: color.goodSoft, marginTop: 8 }}>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                background: color.good,
                width: `${interpolate(frame, [218, 282], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* the proof card: the same window, noisy then clean */}
      <div style={{ position: 'absolute', left: 728, top: 620, width: 280 }}>
        <FloatCard width={280} height={340} delay={270} tilt={3}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: radius.lg }}>
            <img
              src={staticFile('frames/denoise/noisy.png')}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                width: `${interpolate(frame, [286, 336], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
              }}
            >
              <img
                src={staticFile('frames/denoise/median.png')}
                style={{ position: 'absolute', left: 0, top: 0, width: 280, height: 340, objectFit: 'cover' }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 3,
                background: color.ink,
                left: `${interpolate(frame, [286, 336], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
              }}
            />
          </div>
        </FloatCard>
        <div
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontFamily: font.body,
            fontSize: 23,
            color: color.sub,
            direction: 'rtl',
            opacity: interpolate(frame, [300, 326], [0, 1], { extrapolateLeft: 'clamp' }),
          }}
        >
          قبل ← بعد
        </div>
      </div>

      {/* the metrics, once the picture has settled */}
      <div
        style={{
          position: 'absolute',
          left: safe.side,
          right: safe.side,
          top: 1230,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          opacity: interpolate(frame, [300, 326], [0, 1], { extrapolateLeft: 'clamp' }),
        }}
      >
        <MonoValue delay={300} tone="paper">
          PSNR {data?.metrics.median.psnr.toFixed(1)} dB
        </MonoValue>
        <MonoValue delay={312} tone="good">
          SSIM {data?.metrics.median.ssim.toFixed(3)}
        </MonoValue>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1500 }}>
        <CaptionBlock
          title={[{ text: 'الم' }, { text: 'يديان', tone: 'good' }, { text: ' الرقم الأوسط' }]}
          sub="الشاذ بيبان"
          delay={344}
          width={936}
        />
      </div>

      <Sfx name="whoosh" at={6} volume={0.3} />
      {Array.from({ length: 9 }).map((_, i) => (
        <Sfx key={i} name="tick" at={40 + i * 6} volume={0.22} />
      ))}
      <Sfx name="pop" at={150} volume={0.4} />
      <Sfx name="sweep" at={168} volume={0.34} />
      <Sfx name="pop" at={214} volume={0.34} />
      {Array.from({ length: 7 }).map((_, i) => (
        <Sfx key={`c${i}`} name="tick" at={220 + i * 8} volume={0.2} />
      ))}
      <Sfx name="click" at={270} volume={0.3} />
      <Sfx name="sweep" at={286} volume={0.28} />
      <Sfx name="pop" at={300} volume={0.34} />
      <Sfx name="thump" at={344} volume={0.3} />
    </SceneFrame>
  );
};

/* ------------------------------------------------------------ mean vs median */

export const DenoiseCompare: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useDenoiseData();

  const cardW = 400;
  const cardH = 520;
  const leftLeft = 72;
  const rightLeft = 1080 - 72 - cardW;

  // a slow push for the whole scene: two stills would leave ten dead seconds
  const camera = {
    scale: interpolate(frame, [0, duration], [1, 1.17], { extrapolateRight: 'clamp' }),
    x: interpolate(frame, [0, duration], [0, -14], { extrapolateRight: 'clamp' }),
    y: 0,
    originX: 51,
    originY: 26,
  };
  const leftCam = cameraForCard(leftLeft, 300, cardW, cardH, camera);
  const rightCam = cameraForCard(rightLeft, 300, cardW, cardH, camera);

  const show = interpolate(frame, [60, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const verdict = interpolate(frame, [190, 220], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const psnr = (m?: { psnr: number }) => (m ? m.psnr.toFixed(1) : '—');

  return (
    <SceneFrame duration={duration} motif={false} beats={[0, 60, 110, 150, 190, 250, 320, 390]}>
      <BrandMark delay={2} />

      {/* the mean filter smears the edges */}
      <FloatCard width={cardW} height={cardH} delay={0} tilt={2} style={{ left: leftLeft, top: 300 }}>
        <PhotoLayer src={staticFile('frames/denoise/mean.png')} camera={leftCam} />
      </FloatCard>
      <div style={{ position: 'absolute', left: leftLeft, top: 850 }}>
        <div
          style={{
            direction: 'rtl',
            fontFamily: 'Rubik',
            fontWeight: 800,
            fontSize: 40,
            color: color.ink,
            textAlign: 'center',
            opacity: show,
          }}
        >
          المتوسط
        </div>
        <div
          style={{
            marginTop: 10,
            textAlign: 'center',
            fontFamily: 'JetBrains Mono',
            fontSize: 30,
            color: color.accent,
            opacity: show,
          }}
        >
          PSNR {psnr(data?.metrics.mean)} dB
        </div>
      </div>

      {/* the median keeps them */}
      <FloatCard width={cardW} height={cardH} delay={18} tilt={-2} style={{ left: rightLeft, top: 300 }}>
        <PhotoLayer src={staticFile('frames/denoise/median.png')} camera={rightCam} />
      </FloatCard>
      <div style={{ position: 'absolute', left: rightLeft, top: 850 }}>
        <div
          style={{
            direction: 'rtl',
            fontFamily: 'Rubik',
            fontWeight: 800,
            fontSize: 40,
            color: color.ink,
            textAlign: 'center',
            opacity: show,
          }}
        >
          الميديان
        </div>
        <div
          style={{
            marginTop: 10,
            textAlign: 'center',
            fontFamily: 'JetBrains Mono',
            fontSize: 30,
            color: color.accent,
            opacity: show,
          }}
        >
          PSNR {psnr(data?.metrics.median)} dB
        </div>
      </div>

      {/* the verdict stamps — red on the smear, green on the keeper */}
      <div
        style={{
          position: 'absolute',
          left: leftLeft,
          top: 250,
          width: cardW,
          display: 'flex',
          justifyContent: 'center',
          opacity: verdict,
          transform: `translateY(${(1 - verdict) * -26}px) rotate(-3deg)`,
        }}
      >
        <div
          style={{
            padding: '10px 22px',
            borderRadius: radius.pill,
            background: color.bad,
            color: color.onAccent,
            fontFamily: font.body,
            fontWeight: 700,
            fontSize: 26,
            direction: 'rtl',
          }}
        >
          الحواف راحت
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: rightLeft,
          top: 250,
          width: cardW,
          display: 'flex',
          justifyContent: 'center',
          opacity: verdict,
          transform: `translateY(${(1 - verdict) * -26}px) rotate(3deg)`,
        }}
      >
        <div
          style={{
            padding: '10px 22px',
            borderRadius: radius.pill,
            background: color.good,
            color: color.onAccent,
            fontFamily: font.body,
            fontWeight: 700,
            fontSize: 26,
            direction: 'rtl',
          }}
        >
          الحواف بقيت
        </div>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1100 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 18,
            opacity: interpolate(frame, [110, 140], [0, 1], { extrapolateLeft: 'clamp' }),
          }}
        >
          <MonoValue delay={110} tone="paper">
            {psnr(data?.metrics.noisy)} dB
          </MonoValue>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 34, color: color.sub }}>→</div>
          <MonoValue delay={124} tone="ink">
            {psnr(data?.metrics.median)} dB
          </MonoValue>
        </div>
      </div>

      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: 1500 }}>
        <CaptionBlock
          title={[{ text: 'الم' }, { text: 'توسط', tone: 'bad' }, { text: ' يمسّح الحواف' }]}
          sub="الميديان يحفظها"
          delay={330}
          width={936}
        />
      </div>

      <Sfx name="whoosh" at={0} volume={0.3} />
      <Sfx name="whoosh" at={18} volume={0.3} />
      <Sfx name="pop" at={110} volume={0.34} />
      <Sfx name="pop" at={124} volume={0.4} />
      <Sfx name="click" at={150} volume={0.3} />
      <Sfx name="thump" at={190} volume={0.4} />
      <Sfx name="tick" at={210} volume={0.3} />
      <Sfx name="sweep" at={250} volume={0.3} />
      <Sfx name="pop" at={300} volume={0.3} />
      <Sfx name="thump" at={330} volume={0.34} />
      <Sfx name="click" at={390} volume={0.3} />
    </SceneFrame>
  );
};

/* ------------------------------------------------------------------- the end */

export const DenoiseEnd: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useDenoiseData();

  const CARD_W = 840;
  const CARD_H = 1060;
  const CARD_LEFT = 540 - CARD_W / 2;
  const CARD_TOP = 250;

  const camera = {
    scale: interpolate(frame, [0, duration], [1.05, 1.2], { extrapolateRight: 'clamp' }),
    x: interpolate(frame, [0, duration], [0, 26], { extrapolateRight: 'clamp' }),
    y: interpolate(frame, [0, duration], [30, -30], { extrapolateRight: 'clamp' }),
    originX: 51,
    originY: 28,
  };
  const fitted = cameraForCard(CARD_LEFT, CARD_TOP, CARD_W, CARD_H, camera);

  const cta = spring({ frame: frame - 60, fps, config: { damping: 22, stiffness: 170 } });
  const ssimValue = data ? data.metrics.median.ssim.toFixed(3) : '—';
  const psnrValue = data ? data.metrics.median.psnr.toFixed(1) : '—';

  return (
    <SceneFrame duration={duration} motif={false} beats={[0, 60, 110, 175, 245, 320]}>
      <BrandMark delay={2} />

      <FloatCard width={CARD_W} height={CARD_H} delay={0} tilt={-1.5} style={{ left: CARD_LEFT, top: CARD_TOP }}>
        <PhotoLayer src={staticFile('frames/denoise/median.png')} camera={fitted} />
      </FloatCard>

      <div style={{ position: 'absolute', left: CARD_LEFT + 26, top: CARD_TOP + 26 }}>
        <Sunburst size={46} delay={8} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: safe.side,
          right: safe.side,
          top: 1400,
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div
          style={{
            fontFamily: 'Rubik',
            fontWeight: 800,
            fontSize: 54,
            lineHeight: '74px',
            color: color.ink,
            opacity: cta,
            transform: `translateY(${(1 - cta) * 20}px)`,
          }}
        >
          راح <span style={{ color: color.accent }}>والحدة بقيت</span>
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            opacity: interpolate(frame, [175, 205], [0, 1], { extrapolateLeft: 'clamp' }),
          }}
        >
          <MonoValue delay={175} tone="paper">
            PSNR {psnrValue} dB
          </MonoValue>
          <MonoValue delay={190} tone="good">
            SSIM {ssimValue}
          </MonoValue>
        </div>
        {/* the stamp: the reel's whole argument, in one chip */}
        <div
          style={{
            marginTop: 26,
            display: 'flex',
            justifyContent: 'center',
            opacity: interpolate(frame, [245, 275], [0, 1], { extrapolateLeft: 'clamp' }),
            transform: `scale(${interpolate(frame, [245, 275], [0.7, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}) rotate(${interpolate(frame, [245, 275], [-6, -2], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}deg)`,
          }}
        >
          <div
            style={{
              padding: '12px 26px',
              borderRadius: radius.pill,
              background: color.good,
              color: color.onAccent,
              fontFamily: font.body,
              fontWeight: 700,
              fontSize: 28,
              direction: 'rtl',
            }}
          >
            التشويش راح والحدة بقيت
          </div>
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
              height: 64,
              padding: '0 28px',
              borderRadius: radius.pill,
              background: color.chapter,
              color: color.onAccent,
              fontFamily: 'Space Grotesk',
              fontWeight: 600,
              fontSize: 25,
              boxShadow: '0 18px 40px rgba(20,18,12,0.28)',
            }}
          >
            MorphLens — مختبر الصور
          </div>
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: 'Rubik',
            fontSize: 22,
            color: color.faint,
            opacity: interpolate(frame, [320, 350], [0, 1], { extrapolateLeft: 'clamp' }),
          }}
        >
          اكتب MEDIAN
        </div>
      </div>

      <Sfx name="whoosh" at={0} volume={0.3} />
      <Sfx name="pop" at={60} volume={0.34} />
      <Sfx name="click" at={110} volume={0.3} />
      <Sfx name="ratchet" at={175} volume={0.24} />
      <Sfx name="pop" at={190} volume={0.32} />
      <Sfx name="thump" at={245} volume={0.4} />
      <Sfx name="sweep" at={320} volume={0.3} />
      <Sfx name="pop" at={350} volume={0.34} />
    </SceneFrame>
  );
};
