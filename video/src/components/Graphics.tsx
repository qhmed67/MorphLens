/**
 * Graphics.tsx — the motion-graphics layer of the reel.
 *
 * These are the "explainer motions": a drawn arrow that carries the maths
 * from a pixel to a formula, a live histogram that morphs when the image
 * changes, and the 16×16 pixel window with real addresses and values.
 */
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img } from 'remotion';
import { color, font, radius, space, type } from '../styles/tokens';

export type Cell = {
  x: number;
  y: number;
  before: { r: number; g: number; b: number; luma: number };
  bright: { r: number; g: number; b: number; luma: number };
  sharp: { r: number; g: number; b: number; luma: number };
  blur: { r: number; g: number; b: number; luma: number };
  detail: { r: number; g: number; b: number; luma: number };
};

/**
 * An arrow that draws itself, then carries a value label to the end.
 * Used to show *how* the mathematics connects two numbers.
 */
export const Arrow: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay?: number;
  label?: string;
  color?: string;
  width?: number;
  bend?: number;
}> = ({ from, to, delay = 0, label, color: stroke = color.ink, width = 4, bend = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 26, stiffness: 90, mass: 0.8 },
  });
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + bend;
  const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
  const length = 260;
  const angle = Math.atan2(to.y - my, to.x - mx);
  return (
    <svg
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      width={1080}
      height={1920}
    >
      <path
        d={d}
        stroke={stroke}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - progress)}
        opacity={0.9}
      />
      <polygon
        points="0,0 -18,-8 -18,8"
        fill={stroke}
        transform={`translate(${to.x} ${to.y}) rotate(${(angle * 180) / Math.PI + 90})`}
        opacity={progress > 0.9 ? 1 : 0}
      />
      {label ? (
        <text
          x={(from.x + to.x) / 2}
          y={(from.y + to.y) / 2 - 18 + bend / 2}
          textAnchor="middle"
          fill={stroke}
          style={{
            fontFamily: font.mono,
            fontSize: 30,
            fontWeight: 500,
            opacity: interpolate(progress, [0.75, 1], [0, 1], { extrapolateLeft: 'clamp' }),
          }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
};

/**
 * The magnified pixel window: a 16×16 grid of real pixels from the photo,
 * drawn with the addresses (x, y) and the three channel values.
 */
export const PixelGrid: React.FC<{
  cells: Cell[];
  cropX: number;
  cropY: number;
  size: number;
  cell: number;
  delay?: number;
  /** How many cells have typed their value (0..cells.length). */
  revealed: number;
  highlight?: { x: number; y: number; label?: string } | null;
  showAddresses?: boolean;
  tone?: 'paper' | 'ink';
  /** 0..1 — dim the numbers so an overlay (the 3×3 kernel) can sit on top. */
  textOpacity?: number;
}> = ({ cells, cropX, cropY, size, cell, delay = 0, revealed, highlight, showAddresses, tone = 'paper', textOpacity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 24, stiffness: 170 } });
  const stroke = tone === 'ink' ? 'rgba(255,255,255,0.22)' : 'rgba(20,20,18,0.16)';
  const text = tone === 'ink' ? '#FBFAF7' : '#141412';
  return (
    <svg
      width={size}
      height={size}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
    >
      {cells.map((c, index) => {
        const col = c.x - cropX;
        const row = c.y - cropY;
        const shown = index < revealed;
        const isHot = highlight && c.x === highlight.x && c.y === highlight.y;
        // Per-cell contrast: dark ink on light pixels, paper on dark pixels.
        const ink = c.before.luma > 140 ? '#141412' : '#FBFAF7';
        return (
          <g key={`${c.x}-${c.y}`}>
            <rect
              x={col * cell}
              y={row * cell}
              width={cell}
              height={cell}
              fill="none"
              stroke={isHot ? color.ink : stroke}
              strokeWidth={isHot ? 3 : 1}
            />
            {shown ? (
              <text
                x={col * cell + cell / 2}
                y={row * cell + cell / 2 + cell * 0.14}
                textAnchor="middle"
                fill={ink}
                opacity={textOpacity}
                style={{
                  fontFamily: font.mono,
                  fontSize: Math.max(11, cell * 0.42),
                  fontWeight: 500,
                }}
              >
                {c.before.r}
              </text>
            ) : null}
          </g>
        );
      })}
      {showAddresses ? (
        <g opacity={enter}>
          <text
            x={-16}
            y={-14}
            textAnchor="end"
            fill={text}
            style={{ fontFamily: font.mono, fontSize: 22 }}
          >
            x,y
          </text>
          {cells.slice(0, size / cell).map((c, i) =>
            i % 4 === 0 ? (
              <text
                key={`ax-${i}`}
                x={i * cell + cell / 2}
                y={-12}
                textAnchor="middle"
                fill={text}
                opacity={0.7}
                style={{ fontFamily: font.mono, fontSize: 20 }}
              >
                {c.x}
              </text>
            ) : null,
          )}
        </g>
      ) : null}
    </svg>
  );
};

/**
 * The magnifier: the 16×16 crop blown up with nearest-neighbour sampling, so
 * every pixel is a clean square — the same trick the Lab Convolution
 * Explainer uses on the phone.
 */
export const Lens: React.FC<{
  src: string;
  left: number;
  top: number;
  size: number;
  delay?: number;
  radiusKey?: keyof typeof radius;
  label?: string;
}> = ({ src, left, top, size, delay = 0, radiusKey = 'md', label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 150, mass: 1 } });
  const shown = Math.max(1, size * grow);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: shown,
        height: shown,
        borderRadius: radius[radiusKey],
        overflow: 'hidden',
        border: `2px solid ${color.card}`,
        boxShadow: '0 30px 80px rgba(20,20,18,0.35)',
        opacity: grow,
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: `${space[1]}px ${space[2]}px`,
            background: 'rgba(20,20,18,0.72)',
            color: color.onAccent,
            fontFamily: font.caption,
            fontSize: 19,
            lineHeight: '26px',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

/** 64-bin luma histogram, drawn as one filled path (the app's HUD). */
export const Histogram: React.FC<{
  bins: number[];
  width: number;
  height: number;
  delay?: number;
  tone?: 'paper' | 'ink';
  max?: number;
}> = ({ bins, width, height, delay = 0, tone = 'paper', max }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 24, stiffness: 160 } });
  const peak = max ?? Math.max(...bins, 1);
  const step = width / bins.length;
  const points = bins.map((v, i) => `${i * step},${height - (v / peak) * height * 0.94}`);
  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const fill = tone === 'ink' ? 'rgba(251,250,247,0.22)' : 'rgba(20,20,18,0.10)';
  const stroke = tone === 'ink' ? color.onAccent : color.ink;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={area} fill={fill} opacity={enter} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeDasharray={4000}
        strokeDashoffset={4000 * (1 - enter)}
      />
    </svg>
  );
};

/**
 * The transfer curve of a point operation: the map from input level to output
 * level. The app hides this behind a slider; the reel shows it.
 */
export const TransferCurve: React.FC<{
  /** Output level for a given input level (0..255 → 0..255). */
  map: (v: number) => number;
  width: number;
  height: number;
  delay?: number;
  marker?: { input: number; label?: string } | null;
  tone?: 'paper' | 'ink';
}> = ({ map, width, height, delay = 0, marker, tone = 'paper' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 24, stiffness: 150 } });
  const pts: string[] = [];
  for (let v = 0; v <= 255; v += 5) {
    const x = (v / 255) * width;
    const y = height - (map(v) / 255) * height;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const line = `M ${pts.join(' L ')}`;
  const grid = tone === 'ink' ? 'rgba(251,250,247,0.16)' : 'rgba(20,20,18,0.10)';
  const stroke = tone === 'ink' ? color.onAccent : color.ink;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <line x1={0} y1={height} x2={width} y2={0} stroke={grid} strokeWidth={1.5} strokeDasharray="6 8" />
      <line
        x1={width / 2}
        y1={0}
        x2={width / 2}
        y2={height}
        stroke={grid}
        strokeWidth={1.5}
        strokeDasharray="6 8"
      />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={3000}
        strokeDashoffset={3000 * (1 - enter)}
      />
      {marker ? (
        <g opacity={enter}>
          <circle
            cx={(marker.input / 255) * width}
            cy={height - (map(marker.input) / 255) * height}
            r={9}
            fill={stroke}
          />
          {marker.label ? (
            <text
              x={
                marker.input < 80
                  ? (marker.input / 255) * width + 18
                  : (marker.input / 255) * width
              }
              y={
                marker.input < 80
                  ? height - (map(marker.input) / 255) * height + 8
                  : height - (map(marker.input) / 255) * height - 22
              }
              textAnchor={marker.input < 80 ? 'start' : 'middle'}
              fill={stroke}
              style={{ fontFamily: font.mono, fontSize: 22 }}
            >
              {marker.label}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
};

/**
 * A pixel window: the 16×16 crop blown up, with the real grid, the real
 * addresses and the real channel values drawn on top of it.
 */
export const PixelWindow: React.FC<{
  src: string;
  size: number;
  cells: Cell[];
  cropX: number;
  cropY: number;
  revealed: number;
  highlight?: { x: number; y: number; label?: string } | null;
  delay?: number;
  showAddresses?: boolean;
  tone?: 'paper' | 'ink';
  radiusKey?: keyof typeof radius;
  textOpacity?: number;
}> = ({
  src,
  size,
  cells,
  cropX,
  cropY,
  revealed,
  highlight,
  delay = 0,
  showAddresses,
  tone = 'paper',
  radiusKey = 'md',
  textOpacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 160, mass: 1 } });
  const cell = size / 16;
  const hot = highlight
    ? cells.find((c) => c.x === highlight.x && c.y === highlight.y)
    : undefined;
  const hotCol = highlight ? highlight.x - cropX : 0;
  const hotRow = highlight ? highlight.y - cropY : 0;
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: radius[radiusKey],
        overflow: 'visible',
        opacity: grow,
        transform: `scale(${0.86 + 0.14 * grow})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius[radiusKey],
          overflow: 'hidden',
          border: `2px solid ${tone === 'ink' ? 'rgba(251,250,247,0.5)' : color.card}`,
          boxShadow: '0 30px 80px rgba(20,20,18,0.35)',
        }}
      >
        <Img
          src={src}
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
        />
      </div>
      <div style={{ position: 'absolute', inset: 0 }}>
        <PixelGrid
          cells={cells}
          cropX={cropX}
          cropY={cropY}
          size={size}
          cell={cell}
          revealed={revealed}
          highlight={highlight}
          showAddresses={showAddresses}
          tone={tone}
          textOpacity={textOpacity}
        />
      </div>
      {highlight ? (
        <div
          style={{
            position: 'absolute',
            left: hotCol * cell - 4,
            top: hotRow * cell - 4,
            width: cell + 8,
            height: cell + 8,
            border: `3px solid ${color.ink}`,
            borderRadius: 6,
            boxShadow: '0 0 0 3px rgba(251,250,247,0.75)',
          }}
        />
      ) : null}
      {highlight?.label && hot ? (
        <div
          style={{
            position: 'absolute',
            left: hotCol * cell + cell + 14,
            top: hotRow * cell - 18,
            whiteSpace: 'nowrap',
            background: color.ink,
            color: color.onAccent,
            borderRadius: radius.xs,
            padding: '8px 14px',
            fontFamily: font.mono,
            fontSize: 22,
          }}
        >
          {highlight.label}
        </div>
      ) : null}
    </div>
  );
};

/**
 * The 3×3 convolution window — the same idea as the Lab Convolution
 * Explainer, used here to show that sharpening is a weighted sum.
 */
export const KernelWindow: React.FC<{
  size: number;
  cell: number;
  delay?: number;
  weight?: number[];
  tone?: 'paper' | 'ink';
}> = ({ size, cell, delay = 0, weight, tone = 'paper' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 200 } });
  const stroke = tone === 'ink' ? 'rgba(251,250,247,0.35)' : 'rgba(20,20,18,0.22)';
  const text = tone === 'ink' ? color.onAccent : color.ink;
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const index = row * 3 + col;
          const w = weight ? weight[index] : 0;
          return (
            <g key={`${row}-${col}`}>
              <rect
                x={col * cell}
                y={row * cell}
                width={cell}
                height={cell}
                fill={w > 0 ? 'rgba(20,20,18,0.10)' : 'transparent'}
                stroke={stroke}
                strokeWidth={1.5}
              />
              {weight ? (
                <text
                  x={col * cell + cell / 2}
                  y={row * cell + cell / 2 + 9}
                  textAnchor="middle"
                  fill={text}
                  style={{ fontFamily: font.mono, fontSize: cell * 0.34 }}
                >
                  {w === 0 ? '0' : w.toFixed(2)}
                </text>
              ) : null}
            </g>
          );
        }),
      )}
      <rect
        x={-6}
        y={-6}
        width={cell * 3 + 12}
        height={cell * 3 + 12}
        fill="none"
        stroke={color.ink}
        strokeWidth={3}
        rx={10}
        opacity={enter}
      />
    </svg>
  );
};
