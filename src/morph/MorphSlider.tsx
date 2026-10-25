/**
 * MorphSlider — velocity-aware slider whose value is a SharedValue (SKILL §5.6).
 *
 * Props: value (SharedValue 0..1), width, label, onCommit (one JS call at end).
 * The thumb squashes/stretches with velocity; track fill follows the value.
 * Reduced motion: no squash. No dev build required.
 */
import { memo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from '@/core/threads';
import { spring } from '@/core/motion';
import { color, radius } from '@/core/tokens';

type Props = {
  value: SharedValue<number>;
  width: number;
  label: string;
  onCommit?: (value: number) => void;
  testID?: string;
};

const THUMB = 28;

export const MorphSlider = memo(function MorphSlider({
  value,
  width,
  label,
  onCommit,
  testID,
}: Props) {
  const reduced = useReducedMotion();
  const velocity = useSharedValue(0);
  const active = useSharedValue(0);

  const pan = Gesture.Pan()
    .hitSlop({ top: 16, bottom: 16, left: 8, right: 8 })
    .onBegin(() => {
      active.value = withSpring(1, spring.snappy);
    })
    .onChange((event) => {
      value.value = Math.min(1, Math.max(0, value.value + event.changeX / width));
      velocity.value = Math.abs(event.velocityX);
    })
    .onFinalize(() => {
      velocity.value = withSpring(0, spring.gooey);
      active.value = withSpring(0, spring.gooey);
      if (onCommit) scheduleOnRN(onCommit, value.value);
    });

  // Track runs from the thumb's left edge to its centre at value 1, so the
  // fill never outruns the thumb.
  const fillStyle = useAnimatedStyle(() => ({
    width: value.value * (width - THUMB) + THUMB / 2,
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const stretch = reduced
      ? 1
      : interpolate(velocity.value, [0, 2000], [1, 1.6], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: value.value * (width - THUMB) },
        { scaleX: stretch },
        { scaleY: 1 / Math.sqrt(stretch) },
        { scale: 1 + active.value * 0.12 },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const delta = event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05;
          value.value = Math.min(1, Math.max(0, value.value + delta));
          onCommit?.(value.value);
        }}
        style={{ width, height: 44, justifyContent: 'center' }}
      >
        <View
          style={{
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: color.bg[3],
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[
              { height: 6, borderRadius: radius.pill, backgroundColor: color.accent.ink },
              fillStyle,
            ]}
          />
        </View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: (44 - THUMB) / 2,
              width: THUMB,
              height: THUMB,
              borderRadius: radius.pill,
              backgroundColor: color.text.primary,
              // Paper ring keeps the ink thumb visible where it overlaps the
              // ink fill (value near 1) as well as on the grey track (value 0).
              borderWidth: 2,
              borderColor: color.bg[1],
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
});
