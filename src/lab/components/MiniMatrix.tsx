/**
 * MiniMatrix — a tiny 3×3 numeric grid for the convolution explanations.
 *
 * The kernel theatre talks about a 3×3 matrix, but the screen previously only
 * showed it as editable text fields inside a sheet. Reusing this visual in the
 * border cards and the Arabic guide makes "which number multiplies which
 * pixel" obvious without adding another canvas.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, radius, type } from '@/core/tokens';

type Cell = number | string;

type Props = {
  /** Row-major 3×3 values. Strings allow fractions such as `1/9`. */
  values: readonly (readonly Cell[])[];
  /** Cells that are outside the image (tinted, so the border rule is visible). */
  outside?: readonly (readonly boolean[])[];
  /** Put an ink outline around the centre cell. */
  highlightCenter?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
};

export const MiniMatrix = memo(function MiniMatrix({
  values,
  outside,
  highlightCenter = false,
  compact = false,
  accessibilityLabel,
}: Props) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.grid}>
      {values.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((value, colIndex) => {
            const isOutside = outside?.[rowIndex]?.[colIndex] ?? false;
            const isCenter = highlightCenter && rowIndex === 1 && colIndex === 1;
            return (
              <View
                key={colIndex}
                style={[
                  styles.cell,
                  compact && styles.cellCompact,
                  isOutside && styles.cellOutside,
                  isCenter && styles.cellCenter,
                ]}
              >
                <Text
                  style={[
                    styles.value,
                    isOutside && styles.valueOutside,
                    isCenter && styles.valueCenter,
                  ]}
                >
                  {value}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { gap: 2, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: 2 },
  cell: {
    width: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke,
    backgroundColor: color.bg[2],
  },
  cellCompact: { width: 28, height: 22 },
  cellOutside: {
    backgroundColor: color.bg[3],
    borderColor: color.strokeStrong,
  },
  cellCenter: { borderWidth: 1, borderColor: color.accent.ink },
  value: { fontFamily: font.mono, ...type.mono, color: color.text.secondary },
  valueOutside: { color: color.text.tertiary },
  valueCenter: { color: color.text.primary },
});
