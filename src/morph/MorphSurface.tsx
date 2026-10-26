/**
 * MorphSurface — glass panel in three depth levels (design.md §2.2).
 *
 * L1 chrome: glass + hairline + optional blur.
 * L2 sheets: bg.2 @ 88 % + glassStrong.
 * L3 pills/HUD: bg.3 @ 92 % + stronger stroke.
 * Blur is iOS-only here; Android uses the opaque translucent fallback by
 * design (never ship a blur that drops frames). No dev build required.
 */
import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { blur as blurToken, color, radius as radiusToken } from '@/core/tokens';

type Props = {
  level?: 1 | 2 | 3;
  blurred?: boolean;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
};

const levelStyle: Record<1 | 2 | 3, ViewStyle> = {
  1: { backgroundColor: color.glass, borderColor: color.stroke },
  2: { backgroundColor: color.bg[1], borderColor: color.stroke },
  3: { backgroundColor: color.bg[2], borderColor: color.strokeStrong },
};

export const MorphSurface = memo(function MorphSurface({
  level = 1,
  blurred = false,
  borderRadius = radiusToken.lg,
  style,
  children,
  accessibilityLabel,
}: Props) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, { borderRadius }, levelStyle[level], style]}
    >
      {blurred && Platform.OS === 'ios' ? (
        <BlurView
          intensity={blurToken.glass}
          tint="light"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
