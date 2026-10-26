/**
 * Showreel.tsx — the modern showreel: seven fast shots, four photographs,
 * one accent, and numbers that move.
 *
 * Every shot is punctuated by one of the twenty effects
 * (`src/effects/index.tsx`, catalogued in `docs/REEL_EFFECTS.md`):
 *
 *   01 FrameEscape + HeadlineStop      05 Orbit + B-roll Overlay
 *   02 SnapZoom + GrowthCurve          06 Zoom-Through-Cut + Magazine Cover
 *   03 FrameBreak + ChecklistPop       07 Phone Mockup + Liquid Glass + …
 *   04 ZoomPortal + Digital Zoom       …
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { dark, darkFont } from '../styles/theme';
import {
  BeforeAfter,
  BigNumber,
  DarkPage,
  GlassPanel,
  NumberMatrix,
  ScanLine,
  Tag,
  WordCaption,
} from '../components/Modern';
import {
  BrollOverlay,
  ChatTakeover,
  Checklist,
  DollyZoom,
  GreenScreen,
  ChecklistPop,
  DigitalZoom,
  FrameBreak,
  FrameEscape,
  GrowthCurve,
  HeadlineStop,
  LiquidGlass,
  MagazineCover,
  Orbit,
  PhoneMockup,
  SnapZoom,
  ZoomPortal,
  ZoomThroughCut,
} from '../effects';
import { Sfx } from '../components/Chrome';
import { useShowreelData } from '../lib/showreelData';

const SRC = 'frames/showreel';

/** The cell that changed the most — the reel counts that one up. */
function peakOf(
  matrix?: { before: number[]; after: number[] },
  mode: 'any' | 'up' = 'any',
): { from: number; to: number } {
  if (!matrix) return { from: 20, to: 90 };
  let index = 0;
  matrix.before.forEach((v, i) => {
    const delta = matrix.after[i] - v;
    const best = matrix.after[index] - matrix.before[index];
    if (mode === 'up' ? delta > best : Math.abs(delta) > Math.abs(best)) index = i;
  });
  return { from: matrix.before[index], to: matrix.after[index] };
}

/* ------------------------------------------------------------------ title */

export const ShowTitle: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateLeft: 'clamp' });
  const stop = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 300, mass: 0.7 } });

  return (
    <DarkPage glowAt={0.32}>
      {/* 12 — Dolly Zoom: the background rushes in while the subject holds still */}
      <DollyZoom
        delay={0}
        duration={70}
        background={
          <img
            src={staticFile(`${SRC}/frost.png`)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'saturate(0.4) brightness(0.45)',
            }}
          />
        }
        subject={
          /* 03 — Frame Escape: a small card grows past the frame */
          <FrameEscape delay={6} duration={30}>
            <img
              src={staticFile(`${SRC}/ant.png`)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: '52% 42%',
              }}
            />
          </FrameEscape>
        }
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(239,237,228,0.28) 0%, rgba(239,237,228,0.04) 32%, rgba(239,237,228,0.88) 66%, #EFEDE4 100%)',
        }}
      />

      <div style={{ position: 'absolute', top: 90, left: 64, right: 64, display: 'flex', justifyContent: 'space-between' }}>
        <Tag delay={2}>MorphLens · Lab</Tag>
        <Tag accent delay={6}>01 / 07</Tag>
      </div>

      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 240 }}>
        {/* 06 — Headline Stop: the title slams in and holds */}
        {/* the copy names what the shot does: the picture grows past its frame */}
        <HeadlineStop delay={10} style={{ direction: 'rtl', fontSize: 96, textAlign: 'right' }}>
          صورتك
          <br />
          <span style={{ color: dark.good }}>تكبر.</span>
        </HeadlineStop>
      </div>

      <div style={{ position: 'absolute', inset: 0, background: '#FBFAF7', opacity: flash }} />

      <Sfx name="thump" at={0} volume={0.5} />
      <Sfx name="whoosh" at={4} volume={0.34} />
      <Sfx name="pop" at={12} volume={0.36} />
    </DarkPage>
  );
};

/* ------------------------------------------------------------- brightness */

export const ShowBrightness: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useShowreelData();
  const photo = data?.photos.neon;
  const matrix = data?.matrix.neon;
  const peak = peakOf(matrix);

  const wipe = interpolate(frame, [10, 44], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // the transfer curve: out = in + 110
  const curve = Array.from({ length: 24 }, (_, i) => {
    const v = (i / 23) * 255;
    return Math.min(255, v + 110);
  });

  return (
    <DarkPage glowAt={0.26}>
      <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
        <Tag accent delay={0}>02 / 07</Tag>
        <Tag delay={2}>السطوع · Brightness</Tag>
      </div>

      {/* 04 — Snap Zoom: the punch into the sign */}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 150 }}>
        <GlassPanel delay={0} lift style={{ height: 540 }}>
          <SnapZoom to={1.14} delay={6}>
            <BeforeAfter
              before={staticFile(`${SRC}/neon.png`)}
              after={staticFile(`${SRC}/neon_brightness.png`)}
              position={wipe}
              label="قبل / بعد"
            />
          </SnapZoom>
        </GlassPanel>
      </div>

      <div style={{ position: 'absolute', left: 60, top: 760, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
        <BigNumber from={peak.from} to={peak.to} delay={12} duration={34} size={172} color={dark.good} />
        <div style={{ paddingBottom: 30 }}>
          <div style={{ fontFamily: darkFont.label, fontSize: 22, color: dark.faint, letterSpacing: 1 }}>
            BRIGHTNESS
          </div>
          <div style={{ fontFamily: darkFont.mono, fontSize: 26, color: dark.dim, marginTop: 6 }}>
            +110 لكل بكسل
          </div>
        </div>
      </div>

      {/* 08 — Growth Curve: the transfer curve draws itself */}
      <div style={{ position: 'absolute', left: 60, top: 1130 }}>
        <GlassPanel delay={0} style={{ padding: '20px 26px 12px', width: 960 }}>
          <GrowthCurve points={curve} width={908} height={220} delay={16} duration={40} />
        </GlassPanel>
      </div>

      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 200 }}>
        <WordCaption
          words={[{ text: 'السطوع', at: 0 }, { text: 'بيزيد', accent: true, at: 16 }]}
          delay={26}
          size={108}
        />
      </div>

      <Sfx name="sweep" at={10} volume={0.36} />
      <Sfx name="pop" at={46} volume={0.34} />
      <Sfx name="ratchet" at={20} volume={0.2} />
      <Sfx name="ratchet" at={30} volume={0.16} />
    </DarkPage>
  );
};

/* -------------------------------------------------------------- the numbers */

export const ShowNumbers: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useShowreelData();
  const matrix = data?.matrix.frost;
  const changed = matrix ? matrix.before.filter((v, i) => v !== matrix.after[i]).length : 0;

  return (
    <DarkPage glowAt={0.42}>
      <ScanLine duration={90} delay={10} />
      <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
        <Tag accent delay={0}>03 / 07</Tag>
        <Tag delay={2}>الأرقام</Tag>
      </div>

      {/* sixteen digits, big enough to read — not a wall of ninety-six */}
      <div style={{ position: 'absolute', left: 60, top: 250, width: 540 }}>
        <GlassPanel delay={0} lift style={{ padding: 26, height: 540 }}>
          {matrix ? (
            <NumberMatrix
              before={matrix.before.slice(0, 16)}
              after={matrix.after.slice(0, 16)}
              cols={4}
              rows={4}
              cell={122}
              delay={16}
              duration={34}
            />
          ) : null}
        </GlassPanel>
      </div>

      {/* one number, one meaning */}
      <div style={{ position: 'absolute', left: 660, top: 330, width: 380 }}>
        <BigNumber from={0} to={changed} delay={40} duration={40} size={150} color={dark.good} />
        <div
          style={{
            fontFamily: darkFont.body,
            fontSize: 30,
            color: dark.dim,
            marginTop: 6,
            direction: 'rtl',
          }}
        >
          رقم اتغيّر
        </div>
        <div style={{ marginTop: 46 }}>
          <ChecklistPop items={['نقرأ', 'نطبّق', 'نقارن']} delay={56} step={8} />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 200 }}>
        <WordCaption
          words={[{ text: 'كل', at: 0 }, { text: 'رقم', at: 6 }, { text: 'يتغيّر', accent: true, at: 18 }]}
          delay={24}
          size={108}
        />
      </div>

      {Array.from({ length: 8 }).map((_, row) => (
        <Sfx key={row} name="tick" at={16 + row * 7} volume={0.26} />
      ))}
      <Sfx name="pop" at={80} volume={0.3} />
    </DarkPage>
  );
};

/* --------------------------------------------------------------- contrast */

export const ShowContrast: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useShowreelData();
  const matrix = data?.matrix.frost;

  return (
    <DarkPage glowAt={0.36}>
      <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
        <Tag accent delay={0}>04 / 07</Tag>
        <Tag delay={2}>التباين · Contrast</Tag>
      </div>

      {/* 07 — Zoom Portal: a hole opens in the "before" and the "after" shows through */}
      <div style={{ position: 'absolute', left: 60, top: 150, width: 700, height: 1030 }}>
        <GlassPanel delay={0} lift style={{ height: 1030 }}>
          <ZoomPortal
            delay={6}
            duration={34}
            background={
              <img
                src={staticFile(`${SRC}/frost.png`)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.2) brightness(1.02) opacity(0.8)' }}
              />
            }
            foreground={
              <img
                src={staticFile(`${SRC}/frost_contrast.png`)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            }
          />
        </GlassPanel>
      </div>

      {/* 18 — Digital Zoom: the change as a mosaic of blocks */}
      <div style={{ position: 'absolute', left: 800, top: 150, width: 220, height: 280 }}>
        <GlassPanel delay={0} style={{ height: 280 }}>
          <DigitalZoom
            before={
              <img src={staticFile(`${SRC}/frost.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
            after={
              <img
                src={staticFile(`${SRC}/frost_contrast.png`)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            }
            delay={10}
            duration={30}
            blocks={10}
          />
        </GlassPanel>
      </div>

      <div style={{ position: 'absolute', left: 800, top: 500, width: 220 }}>
        <BigNumber from={128} to={128} delay={0} size={124} color={dark.text} />
        <div
          style={{
            fontFamily: darkFont.body,
            fontSize: 28,
            color: dark.dim,
            marginTop: 6,
            direction: 'rtl',
          }}
        >
          الوسط ثابت
        </div>
      </div>

      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 200 }}>
        <WordCaption
          words={[{ text: 'قبل', at: 0 }, { text: 'و', at: 12 }, { text: 'بعد', accent: true, at: 22 }]}
          delay={20}
          size={108}
        />
      </div>

      {[12, 28, 44, 60].map((f) => (
        <Sfx key={f} name="click" at={f} volume={0.3} />
      ))}
    </DarkPage>
  );
};

/* ---------------------------------------------------------------- sharpen */

export const ShowSharpen: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const data = useShowreelData();
  const matrix = data?.matrix.facade;
  const peak = peakOf(matrix, 'up');

  const zoom = interpolate(frame, [0, 60], [1, 2.2], { extrapolateRight: 'clamp' });
  const wipe = interpolate(frame, [58, 96], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <DarkPage glowAt={0.3}>
      <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
        <Tag accent delay={0}>05 / 07</Tag>
        <Tag delay={2}>الحدّة · Sharpen</Tag>
      </div>

      {/* 01 — Orbit: the facade swings around the lens */}
      <div style={{ position: 'absolute', left: 60, top: 150, width: 960, height: 700, overflow: 'hidden' }}>
        <GlassPanel delay={0} lift style={{ height: 700 }}>
          <Orbit delay={4} duration={80} style={{ position: 'absolute', inset: 0 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: `scale(${zoom})`,
                transformOrigin: '30% 60%',
              }}
            >
              {/* 10 — B-roll Overlay: the sharpened pass sits over the original */}
              <BrollOverlay
                base={
                  <img
                    src={staticFile(`${SRC}/facade.png`)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                }
                overlay={
                  <img
                    src={staticFile(`${SRC}/facade_sharpen.png`)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                }
                delay={52}
                duration={22}
                blend="normal"
                opacity={0.92}
              />
            </div>
            {/* the 3×3 window flying over the pixels */}
            <div
              style={{
                position: 'absolute',
                left: `${interpolate(frame, [16, 56], [8, 46], { extrapolateRight: 'clamp' })}%`,
                top: `${interpolate(frame, [16, 56], [58, 22], { extrapolateRight: 'clamp' })}%`,
                width: 190,
                height: 190,
                border: '2px solid rgba(15,122,70,0.9)',
                boxShadow: dark.glow,
                borderRadius: 8,
              }}
            />
          </Orbit>
        </GlassPanel>
      </div>

      <div style={{ position: 'absolute', left: 60, top: 980, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
        <BigNumber from={peak.from} to={peak.to} delay={60} duration={36} size={168} color={dark.good} />
        <div style={{ paddingBottom: 26 }}>
          <div style={{ fontFamily: darkFont.label, fontSize: 22, color: dark.faint, letterSpacing: 1 }}>
            UNSHARP MASK
          </div>
          <div style={{ fontFamily: darkFont.mono, fontSize: 26, color: dark.dim, marginTop: 6 }}>
            in + 1.2 × (in − blur)
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 200 }}>
        <WordCaption
          words={[{ text: 'الحوافّ', at: 0 }, { text: 'تقوّى', accent: true, at: 14 }]}
          delay={40}
          size={108}
        />
      </div>

      <Sfx name="whoosh" at={0} volume={0.3} />
      <Sfx name="sweep" at={52} volume={0.3} />
      <Sfx name="pop" at={96} volume={0.34} />
      <Sfx name="ratchet" at={44} volume={0.18} />
    </DarkPage>
  );
};

/* --------------------------------------------------------------- triptych */

export const ShowTriptych: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const flip = Math.abs(Math.sin(((frame - 12) / 22) * Math.PI));
  const cards = [
    { name: 'ant', file: 'ant.png', op: 'sharpen', label: 'السطوع' },
    { name: 'frost', file: 'frost.png', op: 'contrast', label: 'التباين' },
    { name: 'facade', file: 'facade.png', op: 'sharpen', label: 'الحدّة' },
  ];

  return (
    <DarkPage glowAt={0.48}>
      <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
        <Tag accent delay={0}>06 / 07</Tag>
        <Tag delay={2}>النتايج</Tag>
      </div>

      {/* 15 — Zoom Through Cut: the cut straight into the cover */}
      <ZoomThroughCut
        delay={0}
        cutAt={4}
        first={
          <div style={{ position: 'absolute', inset: 0, background: dark.bg }}>
            <ScanLine duration={40} />
          </div>
        }
        second={
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* 13 — Magazine Cover: the three results as a cover */}
            <MagazineCover title="تلّة فلاتر" coverLine="MORPHLENS · ALGORITHM THEATRE" delay={10}>
              <div style={{ position: 'absolute', left: 60, right: 60, top: 210, display: 'flex', gap: 24 }}>
                {cards.map((card, i) => (
                  <GlassPanel key={card.name} delay={12 + i * 4} lift style={{ flex: 1, height: 940 }}>
                    <BeforeAfter
                      before={staticFile(`${SRC}/${card.file}`)}
                      after={staticFile(`${SRC}/${card.name}_${card.op}.png`)}
                      position={flip}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: '16px 18px',
                        background: 'linear-gradient(0deg, rgba(251,250,247,0.95), rgba(251,250,247,0))',
                        fontFamily: darkFont.body,
                        fontSize: 24,
                        color: dark.text,
                        textAlign: 'center',
                        direction: 'rtl',
                      }}
                    >
                      {card.label}
                    </div>
                  </GlassPanel>
                ))}
              </div>
            </MagazineCover>
          </div>
        }
      />

      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 200 }}>
        <WordCaption
          words={[{ text: 'تلّة', at: 0 }, { text: 'فلاتر', accent: true, at: 10 }]}
          delay={20}
          size={108}
        />
      </div>

      {[12, 34, 56].map((f) => (
        <Sfx key={f} name="click" at={f} volume={0.28} />
      ))}
      <Sfx name="pop" at={76} volume={0.32} />
    </DarkPage>
  );
};

/* -------------------------------------------------------------------- CTA */

export const ShowOutro: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cta = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 180 } });
  const slider = interpolate(frame, [16, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <DarkPage glowAt={0.35}>
      <div style={{ position: 'absolute', top: 70, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
        <Tag accent delay={0}>07 / 07</Tag>
        <Tag delay={2}>MorphLens</Tag>
      </div>

      {/* 19 — Phone Mockup + 14 — Liquid Glass: the app inside a device */}
      <div style={{ position: 'absolute', left: 540 - 250, top: 200 }}>
        <PhoneMockup delay={4} width={500}>
          {/* 16 — Green Screen: the photo is keyed onto the device screen */}
          <GreenScreen
            delay={8}
            duration={10}
            background={<div style={{ position: 'absolute', inset: 0, background: '#00B140' }} />}
            subject={
              <img
                src={staticFile(`${SRC}/ant.png`)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            }
          />
          <LiquidGlass delay={20} style={{ position: 'absolute', left: 16, right: 16, bottom: 16, padding: 18 }}>
            <div style={{ fontFamily: darkFont.mono, fontSize: 18, color: dark.dim, direction: 'ltr' }}>
              out = in + amount·(in − blur(in))
            </div>
            <div style={{ position: 'relative', height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.14)', marginTop: 12 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${slider * 100}%`,
                  borderRadius: 999,
                  background: dark.good,
                  boxShadow: dark.glow,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: darkFont.mono,
                fontSize: 18,
                color: dark.text,
                direction: 'ltr',
              }}
            >
              <span>Sharpening</span>
              <span style={{ color: dark.good }}>{(1.2 * slider).toFixed(2)}</span>
            </div>
          </LiquidGlass>
        </PhoneMockup>
      </div>

      {/* 20 — Checklist: the steps tick themselves off */}
      <div style={{ position: 'absolute', left: 60, top: 1080, width: 520 }}>
        <Checklist
          title="المحتوى"
          items={['السطوع', 'التباين', 'الحدّة', 'الأرقام']}
          delay={30}
          step={8}
        />
      </div>

      {/* 02 — Chat Takeover: the app says the keyword */}
      <ChatTakeover text="اكتب PHOTO" from="right" delay={70} style={{ top: 980 }} />

      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: 170,
          textAlign: 'center',
          opacity: cta,
          transform: `translateY(${(1 - cta) * 26}px)`,
        }}
      >
        <div
          style={{
            direction: 'rtl',
            fontFamily: darkFont.display,
            fontWeight: 800,
            fontSize: 52,
            lineHeight: '70px',
            color: dark.text,
          }}
        >
          MorphLens — مختبر الصور
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: darkFont.label,
            fontWeight: 600,
            fontSize: 22,
            color: dark.dim,
            letterSpacing: 2,
          }}
        >
          MORPHLENS · ALGORITHM THEATRE
        </div>
      </div>

      <Sfx name="whoosh" at={0} volume={0.28} />
      <Sfx name="pop" at={40} volume={0.36} />
      <Sfx name="click" at={58} volume={0.3} />
      <Sfx name="pop" at={74} volume={0.3} />
    </DarkPage>
  );
};
