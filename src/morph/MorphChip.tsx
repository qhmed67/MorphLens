/**
 * MorphChip — compact monochrome operation chip (owner revision 2026-10-20).
 *
 * Old shape was a 64×84 tile with a decorative dot, which truncated labels
 * ("Graysc…") and read as a broken card next to the trace pills. The chip is
 * now a pill that grows with its label: paper + hairline when idle, ink +
 * paper text when active. The press/selected morphs stay on the UI thread and
 * the container-transform origin is still the chip rect (design.md §4).
 */
import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MorphPressable } from './MorphPressable';
import { spring } from '@/core/motion';
import { color, font, radius, space, type } from '@/core/tokens';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
};

export const MorphChip = memo(function MorphChip({
  label,
  active = false,
  onPress,
  testID,
}: Props) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.set(withSpring(active ? 1 : 0, spring.snappy));
  }, [active, progress]);

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [color.bg[1], color.accent.ink]),
    borderColor: interpolateColor(progress.value, [0, 1], [color.strokeStrong, color.accent.ink]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [color.text.primary, color.text.onAccent]),
  }));

  return (
    <MorphPressable
      testID={testID}
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      restRadius={radius.pill}
      pressedRadius={radius.pill}
      haptic
      style={styles.press}
    >
      <Animated.View style={[styles.chip, shellStyle]}>
        <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </MorphPressable>
  );
});

const styles = StyleSheet.create({
  press: { borderRadius: radius.pill },
  chip: {
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: font.caption,
    ...type.caption,
    letterSpacing: 0.2,
  },
});
