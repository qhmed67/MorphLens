/**
 * effects/index.tsx — the twenty video effects.
 *
 * Extracted from the reference ("20 Video Effects Created by Claude") and
 * rebuilt for this project. Every effect is a frame-driven React component —
 * no CSS keyframe animations, no timers, nothing that drifts between renders.
 *
 * The catalogue, the naming and the "where it is used" column live in
 * `docs/REEL_EFFECTS.md`. This file is the implementation.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import {
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { dark, darkFont } from '../styles/theme';

/* ------------------------------------------------------------------ 01 */

/**
 * **Orbit** — the subject swings around the lens on a shallow 3D arc, as if
 * the camera walked around it. Use it to reveal an object from a new angle.
 */
export const Orbit: React.FC<{
  children: ReactNode;
  radius?: number;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}> = ({ children, radius = 26, delay = 0, duration = 60, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rotate = -18 + t * 36;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        perspective: 1200,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `rotateY(${rotate}deg) rotateX(${Math.sin(t * Math.PI) * 6}deg) scale(${
            0.94 + 0.06 * Math.sin(t * Math.PI)
          })`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 02 */

/**
 * **Chat Takeover** — a message bubble slides in and takes the frame, the way
 * a chat notification hijacks a screen. Use it for "the app said this".
 */
export const ChatTakeover: React.FC<{
  text: string;
  from?: 'left' | 'right';
  delay?: number;
  style?: CSSProperties;
}> = ({ text, from = 'left', delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 200 } });
  const left = from === 'left';
  return (
    <div
      style={{
        position: 'absolute',
        left: left ? 60 : undefined,
        right: left ? undefined : 60,
        top: 120,
        maxWidth: 700,
        display: 'flex',
        flexDirection: 'column',
        alignItems: left ? 'flex-start' : 'flex-end',
        ...style,
      }}
    >
      <div
        style={{
          background: dark.panelSolid,
          border: `1px solid ${dark.line}`,
          borderRadius: 26,
          borderBottomLeftRadius: left ? 6 : 26,
          borderBottomRightRadius: left ? 26 : 6,
          padding: '26px 30px',
          color: dark.text,
          fontFamily: darkFont.body,
          fontSize: 30,
          lineHeight: '42px',
          opacity: enter,
          transform: `translateX(${(1 - enter) * (left ? -80 : 80)}px)`,
          boxShadow: '0 22px 50px rgba(60,50,40,0.16)',
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: darkFont.label,
          fontSize: 20,
          color: dark.faint,
          opacity: enter * 0.8,
        }}
      >
        {left ? 'delivered' : 'MorphLens'}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 03 */

/**
 * **Frame Escape** — the picture grows past the edges of the frame and breaks
 * out of it. Use it to go from a small card to a full-bleed moment.
 */
export const FrameEscape: React.FC<{
  children: ReactNode;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}> = ({ children, delay = 0, duration = 34, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <div
      style={{
        // A transformed element becomes the containing block of its absolutely
        // positioned children — so this wrapper has to have a real size.
        position: 'absolute',
        inset: 0,
        transform: `scale(${0.42 + 0.58 * t})`,
        transformOrigin: 'center center',
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ 04 */

/**
 * **Snap Zoom** — a hard, fast punch in that lands and holds. The punchy
 * version of a camera move: most of the travel happens in 8 frames.
 */
export const SnapZoom: React.FC<{
  children: ReactNode;
  to?: number;
  delay?: number;
  style?: CSSProperties;
}> = ({ children, to = 1.35, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, 8], [1, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${t})`,
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ 05 */

/**
 * **Checklist Pop** — items pop in one after another, each with a tick. Use
 * it for "here is what the filter does, step by step".
 */
export const ChecklistPop: React.FC<{
  items: string[];
  delay?: number;
  step?: number;
  style?: CSSProperties;
}> = ({ items, delay = 0, step = 7, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      {items.map((item, i) => {
        const at = delay + i * step;
        const enter = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 300 } });
        const tick = spring({ frame: frame - at - 4, fps, config: { damping: 12, stiffness: 320 } });
        return (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: enter,
              transform: `translateX(${(1 - enter) * 40}px)`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: tick > 0.6 ? dark.good : 'rgba(20,20,18,0.06)',
                border: `1px solid ${tick > 0.6 ? dark.good : dark.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 20,
                fontWeight: 700,
                transform: `scale(${0.6 + 0.4 * tick})`,
              }}
            >
              ✓
            </div>
            <span
              style={{
                fontFamily: darkFont.body,
                fontSize: 30,
                color: dark.text,
                direction: 'rtl',
              }}
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ 06 */

/**
 * **Headline Stop** — the headline slams in, overshoots a hair and holds.
 * The typographic version of a whip-pan.
 */
export const HeadlineStop: React.FC<{
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}> = ({ children, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stop = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 320, mass: 0.7 },
  });
  return (
    <div
      style={{
        fontFamily: darkFont.display,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: -2,
        color: dark.text,
        opacity: Math.min(1, stop * 1.6),
        transform: `translateX(${(1 - stop) * 60}px) scale(${0.9 + 0.1 * stop})`,
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ 07 */

/**
 * **Zoom Portal** — a circular mask opens in the middle of the frame and
 * reveals a second layer through it. Use it to move between two states of
 * the same picture.
 */
export const ZoomPortal: React.FC<{
  background: ReactNode;
  foreground: ReactNode;
  delay?: number;
  duration?: number;
  size?: number;
  style?: CSSProperties;
}> = ({ background, foreground, delay = 0, duration = 30, size = 200, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {background}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 2,
          height: size * 2,
          marginLeft: -size,
          marginTop: -size,
          borderRadius: '50%',
          overflow: 'hidden',
          clipPath: `circle(${t * 50}% at 50% 50%)`,
          boxShadow: dark.glow,
        }}
      >
        {foreground}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 08 */

/**
 * **Growth Curve** — a curve draws itself and the shape grows out of it.
 * Use it whenever a chart has to earn its place.
 */
export const GrowthCurve: React.FC<{
  points: number[];
  width: number;
  height: number;
  delay?: number;
  duration?: number;
  color?: string;
  style?: CSSProperties;
}> = ({ points, width, height, delay = 0, duration = 40, color = dark.text, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const max = Math.max(...points, 1);
  const step = width / Math.max(1, points.length - 1);
  const pts = points.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`);
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', ...style }}>
      <path
        d={`M ${pts.join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={4000}
        strokeDashoffset={4000 * (1 - t)}
        style={{ filter: `drop-shadow(0 0 14px ${color}66)` }}
      />
    </svg>
  );
};

/* ------------------------------------------------------------------ 09 */

/**
 * **Studio Reveal** — the frame is revealed like a studio backdrop rolling
 * away. Use it to open a new section of the reel.
 */
/**
 * **Studio Reveal** — a curtain sits over the picture and lifts off it.
 *
 * (The curtain used to travel the wrong way: it started open and ended up
 * covering the scene, so whatever sat behind it — in practice the whole first
 * shot of this reel — was hidden for the rest of the shot. It now starts
 * closed and lifts.)
 */
export const StudioReveal: React.FC<{
  children: ReactNode;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}> = ({ children, delay = 0, duration = 26, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {children}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dark.bg,
          // closed at t = 0, lifted clean off the frame at t = 1
          transform: `translateY(${-t * 100}%)`,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ 10 */

/**
 * **B-roll Overlay** — a second layer sits over the first, blended, and
 * settles in. Use it to put the "result" over the "source".
 */
export const BrollOverlay: React.FC<{
  base: ReactNode;
  overlay: ReactNode;
  delay?: number;
  duration?: number;
  blend?: 'screen' | 'normal' | 'overlay' | 'multiply';
  opacity?: number;
  style?: CSSProperties;
}> = ({ base, overlay, delay = 0, duration = 24, blend = 'screen', opacity = 0.9, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {base}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: blend,
          opacity: opacity * t,
          transform: `scale(${1.06 - 0.06 * t})`,
        }}
      >
        {overlay}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 11 */

/**
 * **Paper Cutout** — layered paper strips slide in and stack, like a
 * collage. Use it to build a "layer by layer" explanation.
 */
export const PaperCutout: React.FC<{
  strips: { text: string; accent?: boolean }[];
  delay?: number;
  step?: number;
  width?: number;
  /** 'row' lays the slips out side by side — for a row of values. */
  direction?: 'column' | 'row';
  /** Mono type for values, instead of the body face. */
  mono?: boolean;
  style?: CSSProperties;
}> = ({ strips, delay = 0, step = 6, width = 820, direction = 'column', mono = false, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'row' ? 'row' : 'column',
        justifyContent: 'center',
        gap: 10,
        width,
        ...style,
      }}
    >
      {strips.map((strip, i) => {
        const at = delay + i * step;
        const enter = spring({ frame: frame - at, fps, config: { damping: 20, stiffness: 220 } });
        const flip = i % 2 === 0 ? 1 : -1;
        return (
          <div
            key={`${strip.text}-${i}`}
            style={{
              flex: direction === 'row' ? '0 0 auto' : undefined,
              background: strip.accent ? dark.good : dark.panelSolid,
              color: strip.accent ? '#FBFBF8' : dark.text,
              padding: '16px 24px',
              borderRadius: 10,
              fontFamily: mono ? darkFont.mono : darkFont.body,
              fontSize: mono ? 30 : 30,
              direction: 'rtl',
              textAlign: 'right',
              opacity: enter,
              transform:
                direction === 'row'
                  ? `translateY(${(1 - enter) * 18}px) rotate(${(1 - enter) * flip * 4}deg)`
                  : `translateX(${(1 - enter) * flip * 60}px) rotate(${(1 - enter) * flip * -3}deg)`,
              boxShadow: '0 14px 30px rgba(60,50,40,0.12)',
            }}
          >
            {strip.text}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ 12 */

/**
 * **Dolly Zoom** — the Vertigo move: the background zooms while the subject
 * stays exactly the same size. Use it for a "this changes everything" beat.
 */
export const DollyZoom: React.FC<{
  background: ReactNode;
  subject: ReactNode;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}> = ({ background, subject, delay = 0, duration = 50, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${1 + 0.45 * t})`,
          willChange: 'transform',
        }}
      >
        {background}
      </div>
      {subject}
    </div>
  );
};

/* ------------------------------------------------------------------ 13 */

/**
 * **Magazine Cover** — the frame becomes a cover: masthead, headline, a
 * barcode and a cover line. Use it to present the finished result.
 */
export const MagazineCover: React.FC<{
  children: ReactNode;
  title: string;
  coverLine: string;
  delay?: number;
  style?: CSSProperties;
}> = ({ children, title, coverLine, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 180 } });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: enter,
        transform: `scale(${0.96 + 0.04 * enter})`,
        ...style,
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: 4,
            color: dark.text,
          }}
        >
          MORPHLENS
        </div>
        <div style={{ fontFamily: darkFont.mono, fontSize: 22, color: dark.dim }}>
          ISSUE 01 · LAB
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: 90,
        }}
      >
        <div
          style={{
            fontFamily: darkFont.display,
            fontWeight: 800,
            fontSize: 74,
            lineHeight: '82px',
            color: dark.text,
            textShadow: '0 2px 12px rgba(251,250,247,0.9)',
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: darkFont.body,
            fontSize: 26,
            color: dark.good,
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          {coverLine}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: -4,
            width: 92,
            height: 46,
            background: 'repeating-linear-gradient(90deg,#F4F5F7 0 2px,transparent 2px 5px)',
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 14 */

/**
 * **Liquid Glass** — a glass panel with a specular highlight that sweeps
 * across it. Use it for the "the result is inside this" moment.
 */
export const LiquidGlass: React.FC<{
  children: ReactNode;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}> = ({ children, delay = 0, duration = 36, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sweep = interpolate(frame - delay, [0, duration], [-40, 140], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 30,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${dark.line}`,
        backdropFilter: 'blur(18px)',
        opacity: t,
        transform: `scale(${0.94 + 0.06 * t})`,
        ...style,
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 60%)`,
          transform: `translateX(${sweep}%)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ 15 */

/**
 * **Zoom Through Cut** — the camera zooms into frame A and cuts straight
 * into frame B, already zoomed: a match-through. Use it to jump in time or
 * space without a jarring cut.
 */
export const ZoomThroughCut: React.FC<{
  first: ReactNode;
  second: ReactNode;
  delay?: number;
  cutAt?: number;
  style?: CSSProperties;
}> = ({ first, second, delay = 0, cutAt = 18, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, cutAt], [1, 2.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const t2 = interpolate(frame - delay - cutAt, [0, 16], [2.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const after = frame - delay >= cutAt;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {after ? (
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${t2})` }}>{second}</div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${t})` }}>{first}</div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ 16 */

/**
 * **Green Screen** — a green field is keyed out and a new scene shows
 * through. Use it to put the product on a new background.
 */
export const GreenScreen: React.FC<{
  background: ReactNode;
  subject: ReactNode;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
}> = ({ background, subject, delay = 0, duration = 30, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {background}
      {/* the green field that gets keyed out */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#00B140',
          opacity: (1 - t) * 0.85,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, opacity: t }}>{subject}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ 17 */

/**
 * **Frame Break** — the frame cracks into shards that fly apart. Use it for
 * the "the old way breaks" beat.
 */
export const FrameBreak: React.FC<{
  children: ReactNode;
  delay?: number;
  duration?: number;
  /** Tile grid — the picture breaks into rectangles, not pizza slices. */
  cols?: number;
  rows?: number;
  style?: CSSProperties;
}> = ({ children, delay = 0, duration = 24, cols = 4, rows = 6, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const tiles: React.ReactNode[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      // A deterministic direction per tile: the picture breaks apart from
      // its own centre, in a way that never jitters between renders.
      const dx = (col - (cols - 1) / 2) * 26;
      const dy = (row - (rows - 1) / 2) * 16;
      const kick = 1 + ((row * 7 + col * 3) % 5) * 0.12;
      tiles.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: 'absolute',
            left: `${(col / cols) * 100}%`,
            top: `${(row / rows) * 100}%`,
            width: `${100 / cols}%`,
            height: `${100 / rows}%`,
            // a hair of overlap so the tile seams never show as cracks
            transformOrigin: 'center center',
            overflow: 'hidden',
            // the pieces fly in and settle: the frame assembles itself
            transform: `translate(${dx * (1 - t) * kick}px, ${dy * (1 - t) * kick}px) rotate(${
              (dx * (1 - t) * kick) / 90
            }deg) scale(1.03)`,
            opacity: 0.55 + 0.45 * t,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${-col * 100}%`,
              top: `${-row * 100}%`,
              width: `${cols * 100}%`,
              height: `${rows * 100}%`,
            }}
          >
            {children}
          </div>
        </div>,
      );
    }
  }
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>{tiles}</div>
  );
};

/* ------------------------------------------------------------------ 18 */

/**
 * **Digital Zoom** — the picture breaks into a mosaic of blocks that grow
 * into the new image. Use it when the change is *digital*, not optical.
 */
export const DigitalZoom: React.FC<{
  before: ReactNode;
  after: ReactNode;
  delay?: number;
  duration?: number;
  blocks?: number;
  style?: CSSProperties;
}> = ({ before, after, delay = 0, duration = 30, blocks = 14, style }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {before}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${blocks}, 1fr)`,
          gridTemplateRows: `repeat(${blocks}, 1fr)`,
        }}
      >
        {Array.from({ length: blocks * blocks }).map((_, i) => {
          const at = (i % blocks) * 0.5 + Math.floor(i / blocks) * 0.25;
          const cell = interpolate(t - at, [0, 0.6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={i} style={{ overflow: 'hidden', opacity: cell }}>
              <div
                style={{
                  width: `${blocks * 100}%`,
                  height: `${blocks * 100}%`,
                  marginLeft: `-${(i % blocks) * 100}%`,
                  marginTop: `-${Math.floor(i / blocks) * 100}%`,
                }}
              >
                {after}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 19 */

/**
 * **Phone Mockup** — the content sits inside a phone body. Use it to show
 * the app doing the thing, on a device.
 */
export const PhoneMockup: React.FC<{
  children: ReactNode;
  delay?: number;
  width?: number;
  style?: CSSProperties;
}> = ({ children, delay = 0, width = 420, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 180 } });
  const height = Math.round(width * 2.05);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        background: '#0A0B0E',
        border: `2px solid rgba(255,255,255,0.16)`,
        padding: 10,
        boxShadow: '0 34px 70px rgba(60,50,40,0.22)',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 60}px) rotate(${(1 - enter) * -6}deg)`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: width * 0.11,
          overflow: 'hidden',
          background: dark.bg,
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: width * 0.28,
            height: 16,
            borderRadius: 999,
            background: 'rgba(20,20,18,0.85)',
          }}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 20 */

/**
 * **Checklist** — a panel of steps that ticks itself off, one per beat. Use
 * it as the "what this reel covers" card.
 */
export const Checklist: React.FC<{
  items: string[];
  delay?: number;
  step?: number;
  title?: string;
  style?: CSSProperties;
}> = ({ items, delay = 0, step = 9, title, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        background: dark.panelSolid,
        border: `1px solid ${dark.line}`,
        borderRadius: 26,
        padding: '28px 30px',
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: darkFont.label,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: 1.4,
            color: dark.faint,
            marginBottom: 20,
          }}
        >
          {title}
        </div>
      ) : null}
      <ChecklistPop items={items} delay={delay} step={step} />
    </div>
  );
};
