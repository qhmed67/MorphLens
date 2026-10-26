/**
 * Heatmap — visualised denoising error (PLAN §3.2). `computeHeatmap` maps each
 * pixel by its largest channel deviation from the original onto a monochrome
 * ink ramp (paper → mist → graphite → ink), saturating at |Δ|=64 so ordinary
 * residual noise stays legible while broken output clips to solid ink. The
 * ramp is deliberately tonal, not red/orange: the owner's palette is white /
 * black / gray, and error still reads correctly as "more ink = more error".
 * Ramp stops are design tokens; the error scaling is a Lab-display constant.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { color, font, radius, type } from '@/core/tokens';
import type { ImageBuffer } from '@/engine';
import { imageBufferToSkImage } from '@/engine/bridge/skia';

/** Channel deviation (0..64+) at which the ramp reaches solid ink. */
const SATURATION_DELTA = 64;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const STOPS: { at: number; rgb: Rgb }[] = [
  { at: 0, rgb: rgb(color.bg[1]) },
  { at: 0.35, rgb: rgb(color.accent.mist) },
  { at: 0.7, rgb: rgb(color.accent.graphite) },
  { at: 1, rgb: rgb(color.accent.ink) },
];

/** Piecewise-linear ramp lookup for t ∈ [0,1]. */
function ramp(t: number): Rgb {
  for (let i = 1; i < STOPS.length; i += 1) {
    if (t <= STOPS[i].at || i === STOPS.length - 1) {
      const from = STOPS[i - 1];
      const to = STOPS[i];
      const f = Math.min(1, Math.max(0, (t - from.at) / (to.at - from.at)));
      return [
        from.rgb[0] + (to.rgb[0] - from.rgb[0]) * f,
        from.rgb[1] + (to.rgb[1] - from.rgb[1]) * f,
        from.rgb[2] + (to.rgb[2] - from.rgb[2]) * f,
      ];
    }
  }
  return STOPS[0].rgb;
}

/**
 * Diff two same-size buffers into a hot-ramp error image.
 *
 * @returns null when the buffers disagree on size (nothing meaningful to diff).
 * @complexity O(W·H).
 */
export function computeHeatmap(a: ImageBuffer, b: ImageBuffer): ImageBuffer | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  const data = new Uint8ClampedArray(a.width * a.height * 4);
  for (let i = 0; i < a.data.length; i += 4) {
    const delta = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
    );
    const [r, g, bl] = ramp(Math.min(1, delta / SATURATION_DELTA));
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = bl;
    data[i + 3] = 255;
  }
  return { width: a.width, height: a.height, data };
}

type Props = {
  original: ImageBuffer;
  /** The filtered/restored result; null shows the placeholder strip. */
  filtered: ImageBuffer | null;
  width: number;
  height: number;
  testID?: string;
};

/** Error-heatmap strip; see module header. */
export const Heatmap = memo(function Heatmap({ original, filtered, width, height, testID }: Props) {
  const heatmap = useMemo(
    () => (filtered ? computeHeatmap(original, filtered) : null),
    [original, filtered],
  );
  const [image, setImage] = useState<SkImage | null>(null);
  const imageRef = useRef<SkImage | null>(null);

  // Retirement timers are tracked so they cannot outlive the screen.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const retire = useCallback((image: SkImage | null) => {
    if (!image) return;
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      image.dispose();
    }, 250);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const previous = imageRef.current;
    if (!heatmap) {
      imageRef.current = null;
      setImage(null);
      retire(previous);
      return;
    }
    const skImage = imageBufferToSkImage(heatmap);
    imageRef.current = skImage;
    setImage(skImage);
    retire(previous);
  }, [heatmap, retire]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
      imageRef.current?.dispose();
      imageRef.current = null;
    };
  }, []);

  if (!image) {
    return (
      <View style={[styles.placeholder, { width, height }]} testID={testID}>
        <Text style={styles.caption}>Error heatmap off</Text>
      </View>
    );
  }
  return (
    <Canvas style={{ width, height }} testID={testID}>
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="fill" />
    </Canvas>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg[1],
    borderRadius: radius.sm,
  },
  caption: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
});
