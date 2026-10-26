/**
 * Credit — the small "developed by …" line at the foot of the Home.
 *
 * It is a quiet detail, not a banner: a hairline with a highlight travelling
 * along it (the same motion language as the shimmer) and the name in mono.
 * The motion runs on the UI thread, so it costs nothing.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, font, space, type } from '@/core/tokens';

type Props = {
  /** Who built the app. */
  name: string;
  testID?: string;
};

const LINE_WIDTH = 120;
const DOT = 26;

export function Credit({ name, testID }: Props) {
  const reduced = useReducedMotion() ?? false;
  const x = useSharedValue(-DOT);

  useEffect(() => {
    if (reduced) {
      x.value = (LINE_WIDTH - DOT) / 2;
      return;
    }
    x.value = -DOT;
    x.value = withRepeat(
      withTiming(LINE_WIDTH, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => {
      x.value = -DOT;
    };
  }, [reduced, x]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.line}>
        <Animated.View style={[styles.dot, dotStyle]} />
      </View>
      <Text style={styles.text}>{`Developed by ${name}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space[2], marginTop: space[6] },
  line: {
    width: LINE_WIDTH,
    height: 1,
    backgroundColor: color.strokeStrong,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DOT,
    height: 1,
    backgroundColor: color.accent.ink,
  },
  text: {
    fontFamily: font.mono,
    ...type.mono,
    fontSize: 11,
    color: color.text.tertiary,
    letterSpacing: 0.6,
  },
});
