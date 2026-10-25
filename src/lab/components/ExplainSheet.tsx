/**
 * ExplainSheet — the "why" behind an operation (PLAN §3 shared rule: every
 * Lab screen has an Explain sheet). Renders the registry's `explain` block:
 * summary, the formula in mono on a glass slab, and when-to-use guidance.
 * Extra screen-specific notes slot in through `children`.
 */
import { memo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MorphSheet } from '@/morph/MorphSheet';
import { color, font, radius, space, type } from '@/core/tokens';
import type { OperationDef } from '@/engine';
import { ArabicOperationGuide } from './ArabicOperationGuide';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Registry definition to explain; the sheet is inert while null. */
  operation: OperationDef | null;
  /** Screen-specific extras (live parameter hints, tips). */
  children?: ReactNode;
};

export const ExplainSheet = memo(function ExplainSheet({
  visible,
  onClose,
  operation,
  children,
}: Props) {
  return (
    <MorphSheet visible={visible} onClose={onClose} title={operation?.name ?? 'Explain'}>
      <ScrollView contentContainerStyle={styles.content}>
        {operation ? (
          <>
            <Text style={styles.label}>What it does</Text>
            <Text style={styles.body}>{operation.explain.summary}</Text>
            <Text style={styles.label}>Formula</Text>
            <View style={styles.formulaBox}>
              <Text style={styles.formula} selectable>
                {operation.explain.formula}
              </Text>
            </View>
            <Text style={styles.label}>When to use it</Text>
            <Text style={styles.body}>{operation.explain.whenToUse}</Text>
            {children ? <View style={styles.extra}>{children}</View> : null}
            <View style={styles.arabic}>
              <ArabicOperationGuide key={operation.id} defaultOpen opId={operation.id} />
            </View>
          </>
        ) : (
          <Text style={styles.body}>Nothing to explain yet.</Text>
        )}
      </ScrollView>
    </MorphSheet>
  );
});

const styles = StyleSheet.create({
  content: { paddingBottom: space[10], gap: space[2] },
  label: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
    marginTop: space[3],
  },
  body: { fontFamily: font.body, ...type.body, color: color.text.secondary },
  formulaBox: {
    backgroundColor: color.bg[2],
    borderRadius: radius.sm,
    padding: space[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke,
  },
  formula: { fontFamily: font.mono, ...type.mono, color: color.text.primary },
  extra: { marginTop: space[4] },
  arabic: { marginTop: space[4] },
});
