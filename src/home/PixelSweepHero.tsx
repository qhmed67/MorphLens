/**
 * PixelSweepHero — the Home's live visual.
 *
 * The app is about pixels, so the first screen *is* pixels: a 16×16 slice of
 * the Lab's synthetic scene, magnified with nearest-neighbour sampling so every
 * pixel stays a sharp square while a kernel window glides across the grid. It
 * is the Convolution Explainer's idea at poster size — monochrome, ambient, and
 * it never needs a photo.
 *
 * The animation lives entirely on the UI thread (one shared value), so the
 * Home stays at 60 fps while it breathes.
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  FilterMode,
  Image as SkiaImage,
  Path,
  Rect,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, radius } from '@/core/tokens';
import { imageBufferToSkImage } from '@/engine/bridge/skia';
import { boxDownsample, makeSyntheticSource } from '@/lab/source';

/** The magnified grid: 16×16 pixels of the synthetic scene. */
const GRID = 16;

type Props = {
  width: number;
  height: number;
  testID?: string;
};

export function PixelSweepHero({ width, height, testID }: Props) {
  const reduced = useReducedMotion() ?? false;

  const image = useMemo<SkImage | null>(() => {
    const scene = makeSyntheticSource(64);
    const small = boxDownsample(scene, GRID);
    return imageBufferToSkImage(small);
  }, []);

  useEffect(() => {
    return () => {
      image?.dispose();
    };
  }, [image]);

  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      sweep.value = 0.5;
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      sweep.value = 0;
    };
  }, [reduced, sweep]);

  const cell = Math.min(width, height) / GRID;

  // The 4×4 window walks the whole grid: right on the first pass, then
  // diagonally so the second lap does not repeat the first.
  const windowX = useDerivedValue(() => sweep.value * Math.max(0, width - cell * 4));
  const windowY = useDerivedValue(
    () => ((sweep.value * 1.6) % 1) * Math.max(0, height - cell * 4),
  );

  const frameStyle = useAnimatedStyle(() => ({
    opacity: 0.96,
  }));

  const gridPath = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    const stepX = width / GRID;
    const stepY = height / GRID;
    for (let i = 0; i <= GRID; i += 1) {
      const x = Math.round(i * stepX) + 0.5;
      const y = Math.round(i * stepY) + 0.5;
      builder.moveTo(x, 0);
      builder.lineTo(x, height);
      builder.moveTo(0, y);
      builder.lineTo(width, y);
    }
    return builder.build();
  }, [height, width]);

  return (
    <Animated.View style={[styles.frame, { width, height }, frameStyle]} testID={testID}>
      <Canvas style={{ width, height }}>
        {image ? (
          <SkiaImage
            fit="fill"
            height={height}
            image={image}
            sampling={{ filter: FilterMode.Nearest }}
            width={width}
            x={0}
            y={0}
          />
        ) : null}
        <Path path={gridPath} style="stroke" strokeWidth={0.5} color={color.photoStroke} />
        {/* The kernel window gliding over the grid. */}
        <Rect
          color={color.accent.paper}
          height={cell * 4}
          opacity={0.9}
          style="stroke"
          strokeWidth={1.5}
          width={cell * 4}
          x={windowX}
          y={windowY}
        />
        <Rect
          color={color.accent.ink}
          height={cell * 4}
          opacity={0.18}
          width={cell * 4}
          x={windowX}
          y={windowY}
        />
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.accent.ink,
  },
});
