/**
 * MetricBadge — label + rolling `MorphNumber` for the Denoise Arena (PLAN
 * §3.2 / W2.14). The value is formatted by the caller (PSNR 1 decimal, SSIM 2)
 * so the badge stays a dumb display; `null` renders an em-dash placeholder
 * while a run is in flight.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MorphNumber } from '@/morph/MorphNumber';
import { color, font, space, type } from '@/core/tokens';

type Props = {
  label: string;
  /** Raw metric; null while pending. */
  value: number | null;
  /** e.g. (v) => `${v.toFixed(1)}` — receives the raw number. */
  format: (value: number) => string;
  /** Spoken unit for the a11y phrase, e.g. 'decibels'. */
  unit: string;
  testID?: string;
};

export const MetricBadge = memo(function MetricBadge({
  label,
  value,
  format,
  unit,
  testID,
}: Props) {
  const text = value === null ? '—' : format(value);
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <MorphNumber value={text} accessibilityLabel={`${label} ${text} ${unit}`} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: space[0] },
  label: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
  },
});
