/**
 * PhaseScrubber — manual Trace playhead (owner revision 2026-10-20: "the photo
 * is moving … fast. I'm going to control it").
 *
 * A single shared value holds a continuous position across stages; the drag
 * updates it on the UI thread, so the photo crossfade follows the finger with
 * no React state in the loop. React is told only when the nearest stage
 * changes (discrete labels), and no snapping happens on release: the user can
 * park exactly between two stages to compare the morph.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from '@/core/threads';
import { color, radius } from '@/core/tokens';

const THUMB = 20;
const HIT = 26;

type Props = {
  count: number;
  /** Nearest stage index, used only for tick highlighting/a11y. */
  index: number;
  position: SharedValue<number>;
  onScrub: (index: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onStep: (delta: number) => void;
};

export function PhaseScrubber({
  count,
  index,
  position,
  onScrub,
  onScrubStart,
  onScrubEnd,
  onStep,
}: Props) {
  const width = useSharedValue(1);
  const lastReported = useSharedValue(index);

  useEffect(() => {
    lastReported.set(index);
  }, [index, lastReported]);

  const update = (x: number) => {
    'worklet';
    const usable = Math.max(1, width.value - THUMB);
    const fraction = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
    const next = fraction * Math.max(0, count - 1);
    position.set(next);
    const nearest = Math.round(next);
    if (nearest !== lastReported.value) {
      lastReported.set(nearest);
      scheduleOnRN(onScrub, nearest);
    }
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      scheduleOnRN(onScrubStart);
      update(event.x);
    })
    .onUpdate((event) => update(event.x))
    .onFinalize(() => scheduleOnRN(onScrubEnd));

  const fillStyle = useAnimatedStyle(() => {
    const fraction = Math.min(1, Math.max(0, position.value / Math.max(1, count - 1)));
    return { width: fraction * (width.value - THUMB) + THUMB / 2 };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const fraction = Math.min(1, Math.max(0, position.value / Math.max(1, count - 1)));
    return { transform: [{ translateX: fraction * (width.value - THUMB) }] };
  });

  if (count < 2) return null;

  return (
    <View
      onLayout={(event) => {
        width.set(event.nativeEvent.layout.width);
      }}
      style={styles.wrap}
    >
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityLabel="Trace playhead"
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 1, max: count, now: index + 1 }}
          onAccessibilityAction={(event) => {
            onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1);
          }}
          style={styles.hit}
        >
          <View style={styles.track} />
          <Animated.View style={[styles.fill, fillStyle]} />
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <View pointerEvents="none" style={[styles.ticks, { marginHorizontal: THUMB / 2 }]}>
        {Array.from({ length: count }, (_, tick) => (
          <View key={tick} style={[styles.tick, tick === index && styles.tickActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HIT + 8 },
  hit: { height: HIT, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (HIT - 4) / 2,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.bg[3],
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: (HIT - 4) / 2,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.accent.ink,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (HIT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: color.accent.ink,
    borderWidth: 2,
    borderColor: color.bg[1],
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 8,
  },
  tick: { width: 2, height: 2, borderRadius: radius.pill, backgroundColor: color.accent.mist },
  tickActive: { width: 6, height: 2, backgroundColor: color.accent.ink },
});
