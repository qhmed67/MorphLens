/**
 * ArabicGuide — collapsible Arabic explanation card for the Algorithm Theatre.
 *
 * The owner asked for deeper explanations in Arabic without losing the
 * animated demo above. The card is collapsed by default, so it costs one
 * compact row on a phone and expands in place when he wants the theory.
 *
 * Arabic deliberately does not use the brand font families: Inter / Space
 * Grotesk / JetBrains Mono carry no Arabic glyphs. Leaving `fontFamily` unset
 * lets Android/iOS use their native Arabic face (Noto Naskh / SF Arabic) and
 * keeps shaping and diacritics correct.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSurface } from '@/morph/MorphSurface';
import { color, radius, space, type } from '@/core/tokens';

type Props = {
  /** Arabic heading, e.g. 'اشرح لي بالعربية'. */
  title: string;
  /** One-line Arabic hint shown under the heading. */
  subtitle?: string;
  /** Arabic explanation content (paragraphs, formulas, bullets). */
  children: ReactNode;
  /** Open on first render for a dedicated explanation surface. */
  defaultOpen?: boolean;
  testID?: string;
};

export function ArabicGuide({ title, subtitle, children, defaultOpen = false, testID }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <MorphSurface borderRadius={radius.md} level={1} style={styles.card}>
      <MorphPressable
        accessibilityLabel={`${title} — ${open ? 'طي الشرح' : 'فتح الشرح'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        pressedRadius={radius.md}
        restRadius={radius.md}
        style={styles.header}
        testID={testID}
      >
        {open ? (
          <ChevronUp color={color.text.secondary} size={18} strokeWidth={1.75} />
        ) : (
          <ChevronDown color={color.text.secondary} size={18} strokeWidth={1.75} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </MorphPressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </MorphSurface>
  );
}

/** Arabic section heading; platform face, right-to-left. */
export function ArabicHeading({ children }: { children: ReactNode }) {
  return <Text style={styles.arabicHeading}>{children}</Text>;
}

/** Arabic paragraph; platform face, right-to-left. */
export function ArabicText({ children }: { children: ReactNode }) {
  return <Text style={styles.arabicText}>{children}</Text>;
}

/** Arabic bullet line (the dot stays on the right in RTL). */
export function ArabicBullet({ children }: { children: ReactNode }) {
  return <Text style={styles.arabicBullet}>{`• ${children}`}</Text>;
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
  },
  headerText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  title: {
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    fontWeight: '600',
    color: color.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    gap: space[3],
  },
  // Arabic copy deliberately omits `fontFamily`: the brand faces carry no
  // Arabic glyphs, so the platform face keeps joining and marks correct.
  arabicHeading: {
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    fontWeight: '600',
    color: color.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  arabicText: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  arabicBullet: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
