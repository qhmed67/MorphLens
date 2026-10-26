/**
 * Modern.tsx — the modern showreel's component kit.
 *
 * The three pieces that carry the reel:
 *   NumberMatrix  — a grid of numbers that COUNT from the old value to the
 *                   new one, cell by cell. This is the "the numbers move" shot.
 *   BeforeAfter   — two images and a seam that wipes across, so the change is
 *                   visible rather than described.
 *   KineticTitle  — the Arabic headline, word by word, with one word hot.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { dark, darkFont, darkType } from '../styles/theme';

/* -------------------------------------------------------------- the page */

/** The dark page: near-black, a fine grid, a glow that breathes. */
export const DarkPage: React.FC<{ children: ReactNode; glowAt?: number }> = ({
  children,
  glowAt = 0.5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glow = spring({ frame, fps, config: { damping: 26, stiffness: 60, mass: 1 } });
  return (
    <AbsoluteFill style={{ background: dark.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(20,20,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(20,20,18,0.05) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(70% 46% at 50% ${glowAt * 100}%, rgba(15,122,70,0.07) 0%, rgba(239,237,228,0) 68%)`,
          opacity: 0.45 + 0.25 * glow,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** A glass panel — the dark twin of the reference's white card. */
export const GlassPanel: React.FC<{
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
  lift?: boolean;
}> = ({ children, style, delay = 0, lift = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 200 } });
  return (
    <div
      style={{
        background: lift ? dark.panelSolid : dark.panel,
        border: `1px solid ${dark.line}`,
        borderRadius: 26,
        backdropFilter: 'blur(14px)',
        boxShadow: lift ? '0 40px 120px rgba(0,0,0,0.65)' : '0 24px 70px rgba(0,0,0,0.45)',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 26}px)`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* --------------------------------------------------------- number matrix */

/**
 * The matrix of numbers: every cell counts from the value before the filter
 * to the value after it, staggered so the change travels across the grid.
 */
export const NumberMatrix: React.FC<{
  before: number[];
  after: number[];
  cols: number;
  rows: number;
  delay?: number;
  /** How long each cell takes to travel from before to after. */
  duration?: number;
  cell?: number;
  style?: CSSProperties;
  showAddress?: boolean;
  /** How much a cell must move to count as "changed" (accent + glow). */
  threshold?: number;
}> = ({ before, after, cols, rows, delay = 0, duration = 26, cell = 76, style, showAddress, threshold = 10 }) => {
  const frame = useCurrentFrame();
  const total = cols * rows;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
        gridAutoRows: `${cell}px`,
        fontFamily: darkFont.mono,
        ...style,
      }}
    >
      {before.map((from, i) => {
        const to = after[i] ?? from;
        const stagger = (i % cols) * 1.2 + Math.floor(i / cols) * 0.6;
        const at = delay + stagger;
        const value = interpolate(frame - at, [0, duration], [from, to], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
        const moved = Math.abs(to - from) >= threshold;
        const hot = moved && frame - at > duration * 0.5;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: cell * 0.36,
              color: hot ? dark.good : dark.text,
              textShadow: hot ? dark.glow : 'none',
              borderRight: '1px solid rgba(20,20,18,0.07)',
              borderBottom: '1px solid rgba(20,20,18,0.07)',
            }}
          >
            {Math.round(value)}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------ before/after */

/**
 * Two images and a seam. The seam wipes across (or pulses), so the change is
 * *shown* rather than talked about. The "before" side is desaturated.
 */
export const BeforeAfter: React.FC<{
  before: string;
  after: string;
  /** 0 = all before, 1 = all after. */
  position: number;
  label?: string;
  style?: CSSProperties;
  radius?: number;
}> = ({ before, after, position, label, style, radius = 22 }) => {
  const p = Math.max(0, Math.min(1, position));
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: radius,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Img src={after} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${p * 100}%`,
          overflow: 'hidden',
          borderRight: p > 0.002 && p < 0.998 ? `2px solid ${dark.text}` : 'none',
          boxShadow: p > 0.002 && p < 0.998 ? dark.glow : 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'saturate(0.15) brightness(1.04) opacity(0.75)' }}>
          <Img src={before} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
      {p > 0.002 && p < 0.998 ? (
        <div
          style={{
            position: 'absolute',
            left: `calc(${p * 100}% - 22px)`,
            top: '50%',
            width: 44,
            height: 44,
            marginTop: -22,
            borderRadius: 999,
            background: dark.good,
            boxShadow: dark.glow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0A0B0D',
            fontSize: 22,
            fontFamily: darkFont.mono,
            fontWeight: 700,
          }}
        >
          ⇄
        </div>
      ) : null}
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 18,
            padding: '7px 14px',
            borderRadius: 999,
            background: 'rgba(8,9,11,0.72)',
            border: `1px solid ${dark.line}`,
            color: dark.text,
            fontFamily: darkFont.label,
            fontWeight: 600,
            fontSize: 20,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

/* --------------------------------------------------------------- the type */

/** The Arabic headline, word by word, one word in the accent. */
export const KineticTitle: React.FC<{
  words: { text: string; accent?: boolean }[];
  delay?: number;
  size?: number;
  align?: 'left' | 'center';
  style?: CSSProperties;
}> = ({ words, delay = 0, size = darkType.display.fontSize, align = 'left', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${size * 0.18}px ${size * 0.26}px`,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        direction: 'rtl',
        fontFamily: darkFont.display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: `${Math.round(size * 1.1)}px`,
        color: dark.text,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const at = delay + i * 2.5;
        const enter = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 240 } });
        return (
          <span
            key={i}
            style={{
              color: word.accent ? dark.good : dark.text,
              textShadow: word.accent ? dark.glow : 'none',
              opacity: enter,
              transform: `translateY(${(1 - enter) * 34}px) scale(${0.94 + 0.06 * enter})`,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/**
 * WordCaption — the reel's one caption style.
 *
 * The rule the owner asked for: **a page says what it can show, in at most
 * three words.** Each word pops in on its own beat, timed to the evidence it
 * names — so the copy and the picture say the same thing at the same moment —
 * and a coral rule draws under them once the last word lands.
 *
 * `at` is a per-word offset from `delay`; use it to lock a word to the frame
 * where the thing it names happens.
 */
export const WordCaption: React.FC<{
  words: { text: string; accent?: boolean; at?: number }[];
  delay?: number;
  size?: number;
  align?: 'left' | 'center' | 'right';
  style?: CSSProperties;
}> = ({ words, delay = 0, size = 104, align = 'left', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lastAt = delay + (words[words.length - 1]?.at ?? (words.length - 1) * 8);
  const rule = spring({ frame: frame - (lastAt + 5), fps, config: { damping: 20, stiffness: 130 } });
  return (
    <div
      style={{
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: size * 0.3, alignItems: 'baseline' }}>
        {words.map((word, i) => {
          const at = delay + (word.at ?? i * 8);
          const enter = spring({
            frame: frame - at,
            fps,
            config: { damping: 13, stiffness: 260, mass: 0.8 },
          });
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontFamily: darkFont.display,
                fontWeight: 800,
                fontSize: size,
                lineHeight: `${Math.round(size * 1.14)}px`,
                color: word.accent ? dark.good : dark.text,
                opacity: enter,
                transform: `translateY(${(1 - enter) * 40}px) scale(${0.8 + 0.2 * enter}) rotate(${
                  (1 - enter) * -2
                }deg)`,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
      {/* the rule draws under the words once the last one lands */}
      <div
        style={{
          height: 6,
          width: rule * words.length * (size * 0.82),
          marginTop: 14,
          borderRadius: 999,
          background: dark.good,
        }}
      />
    </div>
  );
};

/** A big number that counts up, mono, with a glow. */
export const BigNumber: React.FC<{
  from: number;
  to: number;
  delay?: number;
  duration?: number;
  size?: number;
  suffix?: string;
  color?: string;
  style?: CSSProperties;
}> = ({ from, to, delay = 0, duration = 30, size = 96, suffix, color = dark.text, style }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame - delay, [0, duration], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        fontFamily: darkFont.mono,
        fontWeight: 500,
        fontSize: size,
        lineHeight: '1.05',
        color,
        fontVariantNumeric: 'tabular-nums',
        textShadow: 'none',
        ...style,
      }}
    >
      {Math.round(value)}
      {suffix ? <span style={{ fontSize: size * 0.45, opacity: 0.6 }}>{suffix}</span> : null}
    </div>
  );
};

/** A small caps label, like the reference's pill tags. */
export const Tag: React.FC<{
  children: ReactNode;
  delay?: number;
  accent?: boolean;
  style?: CSSProperties;
}> = ({ children, delay = 0, accent = false, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 280 } });
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 40,
        padding: '0 14px',
        borderRadius: 999,
        background: accent ? dark.accentSoft : 'rgba(255,255,255,0.55)',
        border: `1px solid ${accent ? 'rgba(20,20,18,0.42)' : dark.line}`,
        color: accent ? dark.text : dark.dim,
        fontFamily: darkFont.label,
        fontWeight: 600,
        fontSize: 20,
        letterSpacing: 0.4,
        opacity: enter,
        transform: `scale(${0.86 + 0.14 * enter})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A histogram whose bars fly in and then re-shape into the "after" curve. */
export const HistogramBars: React.FC<{
  before: number[];
  after: number[];
  width: number;
  height: number;
  delay?: number;
  style?: CSSProperties;
}> = ({ before, after, width, height, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const n = before.length;
  const gap = 2;
  const barW = (width - gap * (n - 1)) / n;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, width, height, ...style }}>
      {before.map((v, i) => {
        const to = after[i] ?? v;
        const h = interpolate(frame - delay, [0, 30], [0, v * height], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        const h2 = interpolate(frame - delay - 34, [0, 26], [h, to * height], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
        const hot = Math.abs(to - v) > 0.08;
        return (
          <div
            key={i}
            style={{
              width: barW,
              height: Math.max(2, h2),
              borderRadius: 2,
              background: hot ? dark.good : 'rgba(255,255,255,0.5)',
              boxShadow: hot ? dark.glow : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

/** A scan line that sweeps the frame — the "data" texture. */
export const ScanLine: React.FC<{ duration?: number; delay?: number }> = ({ duration = 60, delay = 0 }) => {
  const frame = useCurrentFrame();
  const y = ((frame - delay) % duration) / duration;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${y * 100}%`,
        height: 2,
        background: `linear-gradient(90deg, rgba(15,122,70,0) 0%, rgba(15,122,70,0.40) 50%, rgba(15,122,70,0) 100%)`,
        boxShadow: dark.glow,
        opacity: 0.7,
      }}
    />
  );
};

/** A cut flash: every shot opens with a two-frame snap of light. */
/**
 * The blink on a cut — three frames of white, no more.
 *
 * (It used to take its colour from "the accent", which after the palette
 * change meant every cut flashed a full-frame green screen.)
 */
export const ShotFlash: React.FC<{ color?: string; frames?: number }> = ({
  color: c = 'rgba(255,255,255,0.96)',
  frames = 3,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: c,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
