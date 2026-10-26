/**
 * Chrome.tsx — the reel's house components.
 *
 * Every piece of chrome in the reference reels, rebuilt for MorphLens:
 * the paper page with its dot grid and sunburst motif, the floating card, the
 * Arabic caption block with one accented word, the step counter, the pill tag
 * and the dark chapter card. Plus the motion sounds.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { color, font, radius, shadow, space, type } from '../styles/tokens';

/* ------------------------------------------------------------------ page */

/** The eight-point sunburst the references scatter across the page. */
export const Sunburst: React.FC<{
  size?: number;
  color?: string;
  opacity?: number;
  style?: CSSProperties;
  delay?: number;
}> = ({ size = 60, color: c = color.ink, opacity = 0.9, style, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spin = interpolate(frame - delay, [0, 240], [0, 26], { extrapolateRight: 'clamp' });
  const pop = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 180 } });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: 'absolute', opacity: opacity * pop, transform: `rotate(${spin}deg)`, ...style }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x={47}
          y={4}
          width={6}
          height={34}
          rx={3}
          fill={c}
          transform={`rotate(${i * 45} 50 50)`}
        />
      ))}
      <circle cx={50} cy={50} r={8} fill={c} />
    </svg>
  );
};


/* ------------------------------------------------------------- backdrop */

/** The paper tones the page steps through — pale, warm, never coloured. */
const BACKDROP_TONES = [color.paper, '#E9E6DA', '#F2F0E7', '#E4E1D4'];

/**
 * One geometry treatment for the page. Four of them, cycled: a dot grid,
 * diagonal stripes, concentric rings and a soft blob. Every one drifts a
 * little so the page is never quite still between beats.
 */
const Geometry: React.FC<{ kind: number; frame: number; opacity: number }> = ({
  kind,
  frame,
  opacity,
}) => {
  if (opacity <= 0.003) return null;
  const drift = frame / 30;
  if (kind === 0) {
    return (
      <AbsoluteFill
        style={{
          opacity,
          backgroundImage: `radial-gradient(rgba(20,20,18,0.055) 1.4px, transparent 1.4px)`,
          backgroundSize: '34px 34px',
          backgroundPosition: `${drift * 7}px ${drift * 3}px`,
        }}
      />
    );
  }
  if (kind === 1) {
    return (
      <AbsoluteFill
        style={{
          opacity,
          backgroundImage: `repeating-linear-gradient(135deg, rgba(20,20,18,0.045) 0 3px, transparent 3px 26px)`,
          backgroundPosition: `${drift * 9}px 0`,
        }}
      />
    );
  }
  if (kind === 2) {
    return (
      <AbsoluteFill
        style={{
          opacity,
          backgroundImage: `repeating-radial-gradient(circle at 16% 84%, rgba(20,20,18,0.05) 0 2px, transparent 2px 56px)`,
          backgroundSize: `${240 + drift * 14}px ${240 + drift * 14}px`,
        }}
      />
    );
  }
  const x = 34 + Math.sin(drift * 0.45) * 24;
  const y = 40 + Math.cos(drift * 0.32) * 16;
  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `radial-gradient(56% 38% at ${x}% ${y}%, rgba(20,20,18,0.06) 0%, rgba(20,20,18,0) 70%)`,
      }}
    />
  );
};

/**
 * Backdrop — the paper behind the cards, and it does not sit still.
 *
 * The owner's note on the first cut of this reel: the background was the same
 * behind every pop, so the pops had nothing to pop against. This layer changes
 * on **every beat you hand it** — the paper steps to the next tone, a new
 * geometry fades in as the old one fades out, and a light band wipes across
 * the page to mark the change. Between beats everything keeps drifting.
 *
 * It stays pale and neutral: in this reel colour means *good* (green) or
 * *bad* (red), so the backdrop never borrows it.
 *
 * `beats` are frames local to the scene.
 */
export const Backdrop: React.FC<{ beats?: number[] }> = ({ beats = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let index = 0;
  beats.forEach((b, i) => {
    if (frame >= b) index = i + 1;
  });
  const beatAt = index === 0 ? -120 : beats[index - 1];
  const settle = spring({ frame: frame - beatAt, fps, config: { damping: 26, stiffness: 95 } });
  const tone = BACKDROP_TONES[index % BACKDROP_TONES.length];
  const geo = index % 4;

  // the wipe that announces the change
  const wipe = interpolate(frame - beatAt, [0, 22], [-0.35, 1.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wiping = frame - beatAt >= 0 && frame - beatAt <= 24;

  return (
    <>
      <AbsoluteFill style={{ background: tone }} />
      <Geometry kind={geo} frame={frame} opacity={settle} />
      <Geometry kind={(geo + 3) % 4} frame={frame} opacity={1 - settle} />
      {wiping ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(105deg, rgba(20,20,18,0) ${wipe * 100 - 26}%, rgba(20,20,18,0.055) ${
              wipe * 100
            }%, rgba(20,20,18,0) ${wipe * 100 + 26}%)`,
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(120% 80% at 50% 40%, rgba(255,255,255,0) 42%, rgba(90,80,60,0.10) 100%)',
        }}
      />
    </>
  );
};

/** The page: the changing backdrop, a few sunbursts, then the content. */
export const Page: React.FC<{ children: ReactNode; motif?: boolean; beats?: number[] }> = ({
  children,
  motif = true,
  beats,
}) => (
  <AbsoluteFill style={{ background: color.paper }}>
    <Backdrop beats={beats} />
    {motif ? (
      <>
        <Sunburst size={54} delay={4} style={{ left: 92, top: 360, opacity: 0.55 }} />
        <Sunburst size={34} delay={22} style={{ right: 120, top: 1180, opacity: 0.4 }} />
        <Sunburst size={26} delay={38} style={{ left: 150, top: 1520, opacity: 0.32 }} />
      </>
    ) : null}
    {children}
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ card */

/**
 * The floating card — the unit of the whole reel. A visual never sits on the
 * page directly; it sits in a card with a hairline, a soft warm shadow and a
 * slight tilt, and it arrives with a rise.
 */
export const FloatCard: React.FC<{
  children: ReactNode;
  width: number;
  height: number;
  delay?: number;
  /** Rotation in degrees (the references tilt their cards by 1–4°). */
  tilt?: number;
  style?: CSSProperties;
  flat?: boolean;
  onExit?: number;
}> = ({ children, width, height, delay = 0, tilt = 0, style, flat = false, onExit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 170, mass: 1 } });
  const leave = onExit
    ? spring({ frame: frame - onExit, fps, config: { damping: 26, stiffness: 150 } })
    : 1;
  const scale = 0.93 + 0.07 * enter;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        borderRadius: radius.lg,
        background: color.card,
        border: `1px solid ${color.hairline}`,
        boxShadow: flat ? shadow.cardFlat : shadow.card,
        overflow: 'hidden',
        opacity: enter * leave,
        transform: `translateY(${(1 - enter) * 42 - (1 - leave) * 30}px) scale(${scale}) rotate(${
          tilt + (1 - enter) * -2
        }deg)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* --------------------------------------------------------------- captions */

/**
 * One segment of a headline.
 *
 * `tone` is the meaning, never decoration: `good` (green) for a result that
 * worked, `bad` (red) for noise or a loss, `mark` to emphasise a neutral
 * keyword without spending a colour on it. No tone = plain ink.
 *
 * `accent` is the old flag, kept as an alias for `mark`.
 */
export type Seg = { text: string; tone?: 'good' | 'bad' | 'mark'; accent?: boolean };

/**
 * The caption block: a bold Arabic headline (one word that carries the
 * meaning — green good, red bad, marked if it is only an emphasis), and a
 * grey second line that says *why*.
 */
export const CaptionBlock: React.FC<{
  title: Seg[];
  sub?: string;
  delay?: number;
  size?: number;
  align?: 'left' | 'center';
  width?: number;
  style?: CSSProperties;
}> = ({ title, sub, delay = 0, size = type.display.fontSize, align = 'center', width = 936, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 21, stiffness: 180, mass: 1 } });
  const subEnter = spring({
    frame: frame - delay - 6,
    fps,
    config: { damping: 22, stiffness: 170 },
  });
  return (
    <div
      style={{
        width,
        textAlign: align,
        direction: 'rtl',
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: `${Math.round(size * 1.22)}px`,
        letterSpacing: 0,
        color: color.ink,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 24}px)`,
        ...style,
      }}
    >
      {title.map((seg, i) => {
        const tone = seg.tone ?? (seg.accent ? 'mark' : undefined);
        if (tone === 'good' || tone === 'bad') {
          return (
            <span key={i} style={{ color: tone === 'good' ? color.good : color.bad }}>
              {seg.text}
            </span>
          );
        }
        // a neutral keyword gets emphasis without a colour
        return (
          <span
            key={i}
            style={
              tone === 'mark'
                ? {
                    background: color.accentSoft,
                    borderRadius: 10,
                    padding: '0 12px',
                    boxShadow: `inset 0 -0.16em 0 ${color.accentSoft}`,
                  }
                : undefined
            }
          >
            {seg.text}
          </span>
        );
      })}
      {sub ? (
        <div
          style={{
            marginTop: 14,
            fontFamily: font.body,
            fontWeight: 400,
            fontSize: type.body.fontSize,
            lineHeight: type.body.lineHeight,
            color: color.sub,
            opacity: subEnter,
            transform: `translateY(${(1 - subEnter) * 16}px)`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** The step counter: `01 / 03` in ink, with the step's name. */
export const StepCounter: React.FC<{
  step: number;
  total: number;
  name: string;
  delay?: number;
}> = ({ step, total, name, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 190 } });
  return (
    <div
      style={{
        position: 'absolute',
        top: 96,
        right: safeSide(),
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: enter,
        transform: `translateX(${(1 - enter) * 20}px)`,
        direction: 'rtl',
      }}
    >
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 24,
          color: color.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
      <span
        style={{
          fontFamily: font.body,
          fontWeight: 500,
          fontSize: 25,
          color: color.ink,
        }}
      >
        {name}
      </span>
    </div>
  );
};

const safeSide = () => 72;

/** A small pill: the numbered badge or the white tag from the references. */
export const PillTag: React.FC<{
  children: ReactNode;
  delay?: number;
  /** 'badge' = a filled accent circle with a number. */
  variant?: 'badge' | 'pill';
  style?: CSSProperties;
}> = ({ children, delay = 0, variant = 'pill', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 260 } });
  const isBadge = variant === 'badge';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isBadge ? 46 : undefined,
        height: isBadge ? 46 : 44,
        padding: isBadge ? 0 : '0 16px',
        borderRadius: radius.pill,
        background: isBadge ? color.accent : color.card,
        border: isBadge ? 'none' : `1px solid ${color.hairlineStrong}`,
        boxShadow: isBadge ? shadow.pill : shadow.cardFlat,
        color: isBadge ? color.onAccent : color.ink,
        fontFamily: isBadge ? font.mono : font.label,
        fontWeight: isBadge ? 500 : 600,
        fontSize: isBadge ? 22 : 22,
        lineHeight: isBadge ? '46px' : '44px',
        opacity: enter,
        transform: `scale(${0.7 + 0.3 * enter})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** The near-black chapter card that opens a section. */
export const ChapterCard: React.FC<{
  en: string;
  ar: string;
  delay?: number;
  hold?: number;
  width?: number;
  height?: number;
}> = ({ en, ar, delay = 0, hold = 70, width = 900, height = 520 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 150 } });
  // The card holds for `hold` frames, then fades out — it must be fully
  // visible in between, so this is an interpolation, not a spring from zero.
  const leave = interpolate(frame, [delay + hold, delay + hold + 16], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - width / 2,
        top: 960 - height / 2,
        width,
        height,
        borderRadius: radius.lg,
        background: color.chapter,
        overflow: 'hidden',
        opacity: enter * leave,
        transform: `scale(${0.94 + 0.06 * enter})`,
        boxShadow: '0 40px 90px rgba(20,18,12,0.35)',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />
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
        <Sunburst size={64} opacity={0.95} />
        <div
          style={{
            fontFamily: font.label,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: 2,
            color: color.onAccent,
            textAlign: 'center',
          }}
        >
          {en}
        </div>
        <div
          style={{
            direction: 'rtl',
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 44,
            color: color.goodOnDark,
            textAlign: 'center',
          }}
        >
          {ar}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ misc */

/** A number that counts up to its target. */
export const CountingNumber: React.FC<{
  from: number;
  to: number;
  delay?: number;
  duration?: number;
  format?: (v: number) => string;
  style?: CSSProperties;
}> = ({ from, to, delay = 0, duration = 24, format, style }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame - delay, [0, duration], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return <span style={style}>{format ? format(value) : Math.round(value)}</span>;
};

/** A mono value chip, the way the references set a number. */
export const MonoValue: React.FC<{
  children: ReactNode;
  delay?: number;
  tone?: 'ink' | 'paper' | 'good' | 'bad' | 'accent';
  style?: CSSProperties;
}> = ({ children, delay = 0, tone = 'paper', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 240 } });
  const isGood = tone === 'good' || tone === 'accent';
  const bg =
    tone === 'ink'
      ? color.chapter
      : isGood
        ? color.good
        : tone === 'bad'
          ? color.bad
          : color.card;
  const fg = tone === 'ink' || isGood || tone === 'bad' ? color.onAccent : color.ink;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '10px 18px',
        borderRadius: radius.sm,
        background: bg,
        border: tone === 'paper' ? `1px solid ${color.hairlineStrong}` : 'none',
        boxShadow: tone === 'paper' ? shadow.cardFlat : shadow.pill,
        color: fg,
        fontFamily: font.mono,
        fontSize: 28,
        lineHeight: '38px',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px) scale(${0.92 + 0.08 * enter})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * A motion sound. The reel has no voiceover and no music, so the SFX carry
 * the rhythm: they land on the same frames as the movement they describe.
 */
export const Sfx: React.FC<{
  name: string;
  /** Local frame of the scene where the sound lands. */
  at: number;
  volume?: number;
}> = ({ name, at, volume = 0.42 }) => (
  <Sequence from={at} name={`sfx:${name}`}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
