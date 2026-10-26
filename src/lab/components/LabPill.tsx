/**
 * LabPill — the compact selector pill shared by the Lab screens (presets,
 * border modes, noise types). Token-styled MorphPressable: resting state is
 * `bg[2]` with a hairline stroke; the active state swaps to the glass-strong
 * fill with an accent ring so selection reads at a glance.
 */
import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { MorphPressable } from '@/morph/MorphPressable';
import { color, font, radius, space, type } from '@/core/tokens';

type Props = {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Arabic labels use the platform face (the brand fonts carry no Arabic). */
  arabic?: boolean;
  testID?: string;
};

export const LabPill = memo(function LabPill({
  label,
  active,
  disabled,
  onPress,
  arabic = false,
  testID,
}: Props) {
  return (
    <MorphPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive, disabled && styles.disabled]}
      testID={testID}
    >
      <Text style={[arabic ? styles.arabicText : styles.text, active && styles.textActive]}>
        {label}
      </Text>
    </MorphPressable>
  );
});

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: color.bg[2],
    borderWidth: 1,
    borderColor: color.stroke,
  },
  pillActive: { backgroundColor: color.glassStrong, borderColor: color.accent.ink },
  text: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  // No fontFamily: use the platform Arabic face so joining/marks stay correct.
  arabicText: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.secondary,
    writingDirection: 'rtl',
  },
  textActive: { color: color.text.primary },
  disabled: { opacity: 0.5 },
});
