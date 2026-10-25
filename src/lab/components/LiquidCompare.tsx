/**
 * LiquidCompare — one photo, two states, one draggable seam.
 *
 * The seam is deliberately a UI-thread shared value so dragging does not
 * re-render React. Two small Skia layers are used instead of a clip path
 * because the animated clip width is a layout property; the result layer sits
 * in an overflow-hidden wrapper whose width follows the thumb.
 */
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { color, font, radius, space, type } from '@/core/tokens';
import { MorphSkeleton } from '@/morph/MorphSkeleton';

type Props = {
  before: SkImage | null;
  after: SkImage | null;
  /** Width / height of the photo; falls back to 4:3. */
  aspectRatio?: number;
  /** Maximum rendered height on a short phone. */
  maxHeight?: number;
  busy?: boolean;
  testID?: string;
};

const HANDLE = 30;

export const LiquidCompare = memo(function LiquidCompare({
  before,
  after,
  aspectRatio = 4 / 3,
  maxHeight = 340,
  busy = false,
  testID,
}: Props) {
  const [width, setWidth] = useState(0);
  const seam = useSharedValue(0.5);
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 4 / 3;
  const height = width > 0 ? Math.min(maxHeight, Math.max(140, width / ratio)) : 240;

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin((event) => {
      if (width > 0) seam.value = Math.min(1, Math.max(0, event.x / width));
    })
    .onUpdate((event) => {
      if (width > 0) seam.value = Math.min(1, Math.max(0, event.x / width));
    });

  const clipStyle = useAnimatedStyle(() => ({ width: seam.value * width }));
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: seam.value * width - 1 }],
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: seam.value * width - HANDLE / 2 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.frame, { height }]}
        testID={testID}
      >
        {/* The "after" look is the base layer and the "before" is clipped on
            the left, so the right of the seam always carries the change. */}
        {after && width > 0 ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <SkiaImage fit="contain" height={height} image={after} width={width} x={0} y={0} />
          </Canvas>
        ) : null}

        {before && after && width > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.resultClip, { height }, clipStyle]}>
            <Canvas style={{ width, height }}>
              <SkiaImage fit="contain" height={height} image={before} width={width} x={0} y={0} />
            </Canvas>
          </Animated.View>
        ) : null}

        {before && !after && width > 0 ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <SkiaImage fit="contain" height={height} image={before} width={width} x={0} y={0} />
          </Canvas>
        ) : null}

        {/* Nothing to show yet: a shimmer instead of a black hole. */}
        {!before && width > 0 ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <MorphSkeleton borderRadius={radius.md} height={height} width={width} />
          </View>
        ) : null}

        {after ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[styles.seam, { height }, lineStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.handle, { top: height / 2 - HANDLE / 2 }, handleStyle]}
            >
              <View style={styles.handleBar} />
              <View style={styles.handleBar} />
            </Animated.View>
          </>
        ) : null}

        <View pointerEvents="none" style={styles.labels}>
          <View style={styles.labelPill}>
            <Text style={styles.label}>BEFORE</Text>
          </View>
          {after ? (
            <>
              <View style={styles.flex} />
              <View style={styles.labelPill}>
                <Text style={styles.label}>AFTER</Text>
              </View>
            </>
          ) : null}
        </View>

        {busy ? (
          <View pointerEvents="none" style={styles.busy}>
            <Text style={styles.busyText}>BUILDING…</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.accent.ink,
  },
  resultClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  seam: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 2,
    backgroundColor: color.accent.paper,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  handle: {
    position: 'absolute',
    left: 0,
    width: HANDLE,
    height: HANDLE,
    borderRadius: radius.pill,
    backgroundColor: color.accent.paper,
    borderWidth: 1.5,
    borderColor: color.accent.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  handleBar: { width: 3, height: 9, borderRadius: 2, backgroundColor: color.accent.ink },
  labels: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    bottom: space[3],
    flexDirection: 'row',
  },
  labelPill: {
    backgroundColor: color.glassStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 3,
  },
  label: {
    fontFamily: font.caption,
    ...type.caption,
    fontSize: 10,
    color: color.accent.ink,
    letterSpacing: 0.8,
  },
  busy: {
    position: 'absolute',
    top: space[3],
    right: space[3],
    backgroundColor: color.glassStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 3,
  },
  busyText: {
    ...type.caption,
    fontFamily: font.caption,
    fontSize: 10,
    color: color.accent.ink,
    letterSpacing: 0.6,
  },
  flex: { flex: 1 },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
