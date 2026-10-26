/**
 * MorphSkeleton — shimmer placeholder with zero layout shift (design.md §4).
 *
 * Props: numeric width, height, borderRadius. A translucent gradient band
 * travels across a glass surface; reduced motion shows a static band.
 * Uses expo-linear-gradient (no Skia canvas, keeps the ≤3-canvas budget).
 * No dev build required.
 */
import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, radius as radiusToken } from '@/core/tokens';

type Props = {
  width: number;
  height: number;
  borderRadius?: number;
  testID?: string;
};

const BAND = 120;

export const MorphSkeleton = memo(function MorphSkeleton({
  width,
  height,
  borderRadius = radiusToken.md,
  testID,
}: Props) {
  const reduced = useReducedMotion();
  const [measured, setMeasured] = useState(width);
  const x = useSharedValue(-BAND);

  useEffect(() => {
    if (reduced || measured <= 0) {
      x.value = Math.max(0, measured / 2 - BAND / 2);
      return;
    }
    x.value = -BAND;
    x.value = withRepeat(
      withTiming(measured, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [reduced, measured, x]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      onLayout={(event) => setMeasured(event.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius, backgroundColor: color.bg[2] }]}
    >
      <Animated.View style={[styles.band, bandStyle]}>
        <LinearGradient
          colors={['transparent', color.glassStrong, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, width: BAND },
});
