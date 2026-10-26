/**
 * MorphNumber — rolling digits (design.md §4 primitive; SKILL §4 contract).
 *
 * Each digit is a clipping window over a 0–9 column; changing the value slides
 * the column with a spring so digits *roll* rather than swap — the "numbers
 * breathe" half of the motion language. Non-digit characters ('.', '∞', '—')
 * render as static text so PSNR/SSIM formatting stays free-form. Mono face at
 * the headline scale keeps columns uniform, which the roll relies on.
 * Reduced motion: digits crossfade via a short timing instead of springing.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { duration, spring } from '@/core/motion';
import { color, font, type } from '@/core/tokens';

/** Column cell height — the headline line box; one digit fills it exactly. */
const CELL = type.headline.lineHeight;
/** Mono advance width at this size; a little padding keeps glyphs centred. */
const DIGIT_WIDTH = 11;

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const RollDigit = memo(function RollDigit({ digit }: { digit: number }) {
  const y = useSharedValue(-digit * CELL);
  const reduced = useReducedMotion();

  useEffect(() => {
    const target = -digit * CELL;
    y.value = reduced
      ? withTiming(target, { duration: duration.fast })
      : withSpring(target, spring.smooth);
  }, [digit, reduced, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.window} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={style}>
        {DIGITS.map((value) => (
          <Text key={value} style={styles.digit}>
            {value}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

type Props = {
  /** Formatted number, e.g. '28.1', '0.93', '∞', '—'. */
  value: string;
  /** Full phrase for screen readers (e.g. 'PSNR 28.1 decibels'). */
  accessibilityLabel: string;
  testID?: string;
};

/** Rolling-digit numeric readout; see module header. */
export const MorphNumber = memo(function MorphNumber({ value, accessibilityLabel, testID }: Props) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={styles.row}
      testID={testID}
    >
      {value.split('').map((char, index) =>
        char >= '0' && char <= '9' ? (
          <RollDigit key={index} digit={Number(char)} />
        ) : (
          <Text key={`char-${index}-${char}`} style={styles.static}>
            {char}
          </Text>
        )
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  window: { width: DIGIT_WIDTH, height: CELL, overflow: 'hidden' },
  digit: {
    fontFamily: font.mono,
    fontSize: type.headline.fontSize,
    lineHeight: CELL,
    color: color.text.primary,
    textAlign: 'center',
  },
  static: {
    fontFamily: font.mono,
    fontSize: type.headline.fontSize,
    lineHeight: CELL,
    color: color.text.secondary,
  },
});
