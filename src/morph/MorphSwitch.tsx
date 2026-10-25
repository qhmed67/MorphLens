/**
 * MorphSwitch — liquid toggle; thumb stretches while moving (SKILL §4).
 *
 * Props: value, onValueChange, disabled, accessibilityLabel, testID.
 * Reduced motion: short crossfade, no stretch.
 * No dev build required.
 */
import { memo, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { duration, spring } from '@/core/motion';
import { color, radius } from '@/core/tokens';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
};

const W = 52;
const H = 30;
const PAD = 3;
const THUMB = 24;

export const MorphSwitch = memo(function MorphSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  testID,
}: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);
  const stretch = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = withTiming(value ? 1 : 0, { duration: duration.fast });
      return;
    }
    stretch.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, spring.gooey));
    progress.value = withSpring(value ? 1 : 0, spring.snappy);
  }, [value, reduced, progress, stretch]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [color.bg[3], color.accent.ink]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: PAD + progress.value * (W - THUMB - PAD * 2) },
      { scaleX: 1 + (reduced ? 0 : stretch.value * 0.35) },
    ],
  }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={12}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onValueChange(!value);
      }}
    >
      <Animated.View
        style={[
          {
            width: W,
            height: H,
            borderRadius: radius.pill,
            justifyContent: 'center',
            opacity: disabled ? 0.4 : 1,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: radius.pill,
              backgroundColor: color.accent.paper,
              borderWidth: 1,
              borderColor: color.stroke,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});
