/**
 * BorderModes — selectable border-mode cards for the convolution Lab.
 *
 * The old three pills gave no clue what Clamp/Reflect/Zero did, and switching
 * them changes only the outermost pixel ring, which is invisible in a
 * downscaled preview. Each card now shows a corner example with a 3×3 average
 * kernel: shaded cells are the values the kernel reads from outside the image,
 * and the result (59 / 76 / 30) makes the difference obvious.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space, type } from '@/core/tokens';
import { MorphPressable } from '@/morph/MorphPressable';
import { BORDER_INFO, BORDER_OUTSIDE, isIdentityKernel } from '../borderModes';
import { MiniMatrix } from './MiniMatrix';

type Props = {
  border: number;
  /** Current 3×3 kernel, so the panel can warn when border mode cannot matter. */
  weights: readonly number[];
  onChange: (next: number) => void;
  /** Optional shortcut that swaps the identity kernel for a neighbour-reading one. */
  onTryBlur?: () => void;
  disabled?: boolean;
  testID?: string;
};

export const BorderModes = memo(function BorderModes({
  border,
  weights,
  onChange,
  onTryBlur,
  disabled,
  testID,
}: Props) {
  const identity = isIdentityKernel(weights);
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>Border mode</Text>
      <Text style={styles.hint}>
        Border mode decides what the kernel reads outside the photo. It can only change the
        outermost 1-pixel frame; the cards below are a worked 3×3 average example.
      </Text>
      <Text style={styles.arabicHint}>
        وضع الحدود يحدد ماذا يقرأ الـ kernel خارج الصورة، ويؤثر فقط على إطار 1 بكسل. البطاقات مثال
        بمتوسط 3×3.
      </Text>

      {identity ? (
        <View style={styles.callout} testID="border-identity-note">
          <Text style={styles.calloutText}>
            Your kernel is Identity: only the centre pixel is read, so changing the border mode
            cannot change anything. Use a kernel that reads neighbours to see the edge react.
          </Text>
          <Text style={styles.calloutArabic}>
            الـ kernel الحالي Identity: يقرأ البكسل المركزي فقط، لذلك وضع الحدود لا يغيّر شيئًا. جرّب
            Blur أو Sharpen لترى الفرق عند الحافة.
          </Text>
          {onTryBlur ? (
            <MorphPressable
              accessibilityLabel="Switch to the Blur kernel"
              onPress={onTryBlur}
              pressedRadius={radius.pill}
              restRadius={radius.pill}
              style={styles.calloutButton}
            >
              <Text style={styles.calloutButtonText}>Try Blur</Text>
            </MorphPressable>
          ) : null}
        </View>
      ) : null}

      {BORDER_INFO.map((info, index) => {
        const active = border === index;
        return (
          <MorphPressable
            key={info.label}
            accessibilityLabel={`${info.label} border: ${info.english}. Example average ${info.result}.`}
            accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
            disabled={disabled}
            onPress={() => onChange(index)}
            pressedRadius={radius.md}
            restRadius={radius.md}
            style={[styles.card, active && styles.cardActive, disabled && styles.disabled]}
          >
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{info.label}</Text>
                {active ? <Text style={styles.activeBadge}>ACTIVE</Text> : null}
              </View>
              <Text style={styles.arabic}>{info.arabic}</Text>
              <Text style={styles.result}>{`Σ ÷ 9 = ${info.result}`}</Text>
            </View>
            <MiniMatrix compact highlightCenter outside={BORDER_OUTSIDE} values={info.values} />
          </MorphPressable>
        );
      })}
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
    color: color.text.tertiary,
    marginTop: -space[1],
  },
  arabicHint: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: space[1],
  },
  callout: {
    gap: space[1],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent.ink,
    backgroundColor: color.glassStrong,
  },
  calloutText: {
    fontFamily: font.body,
    ...type.caption,
    color: color.text.primary,
  },
  calloutArabic: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calloutButton: {
    alignSelf: 'flex-start',
    marginTop: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    backgroundColor: color.accent.ink,
  },
  calloutButtonText: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.onAccent,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke,
    backgroundColor: color.bg[2],
  },
  cardActive: {
    backgroundColor: color.glassStrong,
    borderColor: color.accent.ink,
    borderWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  name: {
    fontFamily: font.headline,
    ...type.headline,
    color: color.text.primary,
  },
  activeBadge: {
    fontFamily: font.mono,
    ...type.mono,
    color: color.text.tertiary,
  },
  arabic: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  result: {
    fontFamily: font.mono,
    ...type.mono,
    color: color.text.primary,
  },
  disabled: { opacity: 0.5 },
});
