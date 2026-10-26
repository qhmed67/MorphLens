/**
 * MorphPressable — the base pressable used by every button and card.
 *
 * Props: Pressable props minus `style`, plus optional haptic/radii.
 * States: rest, pressed (scale .96 + radius grows), disabled, reduced motion.
 * No dev build required.
 */
import { memo, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { duration, spring } from '@/core/motion';
import { radius } from '@/core/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  haptic?: boolean;
  restRadius?: number;
  pressedRadius?: number;
};

export const MorphPressable = memo(function MorphPressable({
  style,
  children,
  haptic = true,
  restRadius = radius.lg,
  pressedRadius = radius.xl,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0); // 0 rest → 1 pressed

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.96]) }],
    borderRadius: interpolate(progress.value, [0, 1], [restRadius, pressedRadius]),
    opacity: reduced ? interpolate(progress.value, [0, 1], [1, 0.75]) : 1,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPressIn={(event) => {
        progress.value = reduced
          ? withTiming(1, { duration: duration.instant })
          : withSpring(1, spring.snappy);
        if (haptic && !disabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.value = reduced
          ? withTiming(0, { duration: duration.fast })
          : withSpring(0, spring.gooey);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});
