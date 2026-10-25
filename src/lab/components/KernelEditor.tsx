/**
 * KernelEditor — editable 3×3 kernel with presets and border mode (PLAN §3.1
 * / W2.12). Values are plain text inputs: students type real weights (this is
 * a course tool, not a slider toy), commits land on blur/focus-loss, and the
 * presets pull their matrices straight from the engine's kernel factories so
 * what you see is exactly what `convolve` runs. The border segmented control
 * mirrors the registry's numeric border (0 clamp · 1 reflect · 2 zero) —
 * explicit border handling is a graded concept, so it is first-class UI. The
 * border choice is rendered as three explanatory cards (not bare pills) because
 * the real change is confined to the outermost pixel ring.
 */
import { memo, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, font, radius, space, type } from '@/core/tokens';
import { embossKernel, gaussianKernel3x3, sharpenKernel, sobelKernel } from '@/engine';
import { parseKernelWeight } from '../kernelInput';
import { BorderModes } from './BorderModes';
import { LabPill } from './LabPill';

/** Spatial identity: centre 1, everything else 0 — the image is unchanged. */
const IDENTITY_WEIGHTS = [0, 0, 0, 0, 1, 0, 0, 0, 0];

/** The 3×3 Gaussian used by the Blur preset and the border "Try Blur" shortcut. */
const BLUR_WEIGHTS = Array.from(gaussianKernel3x3(1).weights);

/** Preset matrices from the engine factories (PLAN §3.1 list). */
const PRESETS: { id: string; label: string; weights: number[] }[] = [
  { id: 'identity', label: 'Identity', weights: IDENTITY_WEIGHTS },
  // The editor is a 3×3 matrix: a 7×7 Gaussian would be mapped onto the
  // first nine cells and turn the whole preview black.
  { id: 'blur', label: 'Blur', weights: BLUR_WEIGHTS },
  { id: 'sharpen', label: 'Sharpen', weights: Array.from(sharpenKernel().weights) },
  { id: 'sobel', label: 'Sobel X', weights: Array.from(sobelKernel('x').weights) },
  { id: 'emboss', label: 'Emboss', weights: Array.from(embossKernel().weights) },
];

/** Short decimal rendering for an editable weight cell. */
function formatWeight(value: number): string {
  return String(Math.round(value * 100) / 100);
}

type Props = {
  /** The nine weights in row-major order. */
  weights: number[];
  onWeightsChange: (next: number[]) => void;
  /** Registry border index: 0 clamp · 1 reflect · 2 zero. */
  border: number;
  onBorderChange: (next: number) => void;
  disabled?: boolean;
  testID?: string;
};

export const KernelEditor = memo(function KernelEditor({
  weights,
  onWeightsChange,
  border,
  onBorderChange,
  disabled,
  testID,
}: Props) {
  const [texts, setTexts] = useState(() => weights.map(formatWeight));
  const [focused, setFocused] = useState(-1);
  // Re-seed the editable strings whenever the canonical weights change
  // (preset tap or an external reset); typing alone must not loop back.
  const weightsKey = weights.join(',');
  useEffect(() => {
    setTexts(weights.map(formatWeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key-based sync avoids commit loops
  }, [weightsKey]);

  const commit = (index: number, text: string) => {
    const parsed = parseKernelWeight(text);
    if (parsed === null) {
      // Empty or invalid input reverts instead of becoming Number('') === 0.
      setTexts(weights.map(formatWeight));
      return;
    }
    const next = [...weights];
    next[index] = parsed;
    onWeightsChange(next);
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>Kernel weights · 3×3</Text>
      <Text style={styles.hint}>
        Centre = the current pixel. Each number is the weight of the pixel under it.
      </Text>
      <Text style={styles.arabicHint}>
        المصفوفة 3×3 هي الـ kernel: الوزن في كل خانة يحدد تأثير البكسل اللي تحتها، والمركز هو البكسل
        الحالي.
      </Text>
      <View style={styles.grid}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.row}>
            {[0, 1, 2].map((col) => {
              const index = row * 3 + col;
              return (
                <TextInput
                  key={col}
                  accessibilityLabel={`Kernel weight row ${row + 1} column ${col + 1}`}
                  editable={!disabled}
                  keyboardType="decimal-pad"
                  onBlur={() => {
                    setFocused(-1);
                    commit(index, texts[index]);
                  }}
                  onChangeText={(text) =>
                    setTexts((previous) => previous.map((value, i) => (i === index ? text : value)))
                  }
                  onFocus={() => setFocused(index)}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={[
                    styles.cell,
                    focused === index && styles.cellFocused,
                    disabled && styles.disabled,
                  ]}
                  value={texts[index]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.label}>Presets</Text>
      <View style={styles.pills}>
        {PRESETS.map((preset) => (
          <LabPill
            key={preset.id}
            active={weights.join(',') === preset.weights.join(',')}
            disabled={disabled}
            label={preset.label}
            onPress={() => {
              // Commit the focused field before the preset overwrites the
              // matrix; otherwise its later blur can undo the preset.
              Keyboard.dismiss();
              onWeightsChange([...preset.weights]);
            }}
          />
        ))}
      </View>

      <BorderModes
        border={border}
        disabled={disabled}
        onTryBlur={() => {
          Keyboard.dismiss();
          onWeightsChange([...BLUR_WEIGHTS]);
        }}
        weights={weights}
        onChange={(next) => {
          Keyboard.dismiss();
          onBorderChange(next);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: space[2] },
  label: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: font.body,
    ...type.caption,
    color: color.text.secondary,
  },
  arabicHint: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  grid: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2] },
  cell: {
    flex: 1,
    height: space[10],
    backgroundColor: color.bg[2],
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: color.stroke,
    color: color.text.primary,
    fontFamily: font.mono,
    fontSize: type.body.fontSize,
    textAlign: 'center',
  },
  cellFocused: { borderColor: color.accent.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  disabled: { opacity: 0.5 },
});
