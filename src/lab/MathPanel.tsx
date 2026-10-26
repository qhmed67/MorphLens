/**
 * MathPanel — the motion-graphics half of Trace (owner revision 2026-10-20:
 * "I need it explaining more in motion graphics … and type the code of it").
 *
 * Maths tab: the live formula, a Skia plot of the probe pixel's grey level in
 * every stage, and a cursor/light that glides with the playhead. The probe is
 * the pixel that changed most, so the numbers describe real texture/edges.
 * Code tab: a typewriter reveal of the engine excerpt that performs the step.
 *
 * The cursor is a derived value, not React state — scrubbing stays on the UI
 * thread; only the discrete stage highlight re-renders.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Path, Rect, Skia } from '@shopify/react-native-skia';
import Animated, { FadeIn, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { RotateCcw } from 'lucide-react-native';
import { duration, labMotion } from '@/core/motion';
import { color, font, radius, space, type } from '@/core/tokens';
import { MorphPressable } from '@/morph/MorphPressable';
import { ArabicOperationContent } from './components/ArabicOperationGuide';
import { LabPill } from './components/LabPill';
import { codeExcerpt } from './codeExcerpts';
import type { StageSet } from './stages';

const PLOT_H = 64;
const PAD = 10;
const TAB_MATHS = 'maths';
const TAB_CODE = 'code';
const TAB_ARABIC = 'arabic';

type Props = {
  stageSet: StageSet;
  index: number;
  position: SharedValue<number>;
  onSeek: (index: number) => void;
  /** Effective registry params (after the slider override) for the readout. */
  params: Record<string, number>;
  reduced: boolean;
  /** Tightens the card on short phones; content still scrolls. */
  compact?: boolean;
  /** Fixed panel height, so the screen does not resize when the content loads. */
  height?: number;
};

function clamp01(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

/** Screen y for a 0..255 grey level inside the plot. */
function plotY(value: number): number {
  // This helper is called from a `useDerivedValue` worklet, so it has to be a
  // worklet itself: a plain function would be treated as a remote function and
  // the UI runtime would refuse to call it synchronously.
  'worklet';
  return PAD + (1 - clamp01(value / 255)) * (PLOT_H - PAD * 2);
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function ProbePlot({
  width,
  values,
  position,
}: {
  width: number;
  values: number[];
  position: SharedValue<number>;
}) {
  const last = Math.max(1, values.length - 1);
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    values.forEach((value, stage) => {
      const x = (stage / last) * width;
      if (stage === 0) builder.moveTo(x, plotY(value));
      else builder.lineTo(x, plotY(value));
    });
    return builder.build();
  }, [values, width, last]);

  const cursorX = useDerivedValue(() => {
    const p = Math.min(values.length - 1, Math.max(0, position.value));
    return (p / Math.max(1, values.length - 1)) * width;
  });
  const cursorY = useDerivedValue(() => {
    // The maths is inlined on purpose: a worklet may only call other
    // worklets, and a plain helper would be treated as a remote function
    // (the UI runtime then refuses to call it synchronously).
    const p = Math.min(values.length - 1, Math.max(0, position.value));
    const from = Math.floor(p);
    const to = Math.min(values.length - 1, from + 1);
    const value = values[from] + (values[to] - values[from]) * (p - from);
    const clamped = Math.min(1, Math.max(0, value / 255));
    return PAD + (1 - clamped) * (PLOT_H - PAD * 2);
  });

  return (
    <Canvas style={{ width, height: PLOT_H }}>
      {[0.25, 0.5, 0.75].map((fraction) => (
        <Rect
          key={fraction}
          color={color.stroke}
          height={1}
          width={width}
          x={0}
          y={PAD + fraction * (PLOT_H - PAD * 2)}
        />
      ))}
      <Path
        color={color.accent.ink}
        path={path}
        strokeJoin="round"
        strokeWidth={1.5}
        style="stroke"
      />
      {values.map((value, stage) => (
        <Circle
          key={stage}
          color={color.accent.silver}
          cx={(stage / last) * width}
          cy={plotY(value)}
          r={2.5}
        />
      ))}
      <Rect color={color.strokeStrong} height={PLOT_H} width={1} x={cursorX} y={0} />
      <Circle
        color={color.accent.paper}
        cx={cursorX}
        cy={cursorY}
        r={7}
        strokeWidth={2.5}
        style="stroke"
      />
      <Circle color={color.accent.ink} cx={cursorX} cy={cursorY} r={3.5} />
    </Canvas>
  );
}

function MathsPanel({
  stageSet,
  index,
  position,
  onSeek,
  params,
  reduced,
  height,
}: Omit<Props, 'reduced'> & { reduced: boolean }) {
  const [plotWidth, setPlotWidth] = useState(0);
  const current = stageSet.values[index] ?? 0;
  const paramLine = Object.entries(params)
    .map(([key, value]) => `${key} ${trim(value)}`)
    .join(' · ');

  return (
    <ScrollView
      contentContainerStyle={styles.bodyContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={styles.body}
    >
      <Text style={styles.label}>FORMULA</Text>
      <Text selectable style={styles.formula}>
        {stageSet.formula}
      </Text>

      <View style={styles.plotHead}>
        <Text style={styles.label}>PROBE · MOST-CHANGED PIXEL</Text>
        <Text style={styles.coord}>{`x ${stageSet.probe.x} · y ${stageSet.probe.y}`}</Text>
      </View>
      <View
        onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
        style={styles.plotBed}
      >
        {plotWidth > 0 ? (
          <ProbePlot position={position} values={stageSet.values} width={plotWidth} />
        ) : null}
      </View>

      <View style={styles.readoutRow}>
        <Animated.Text
          key={index}
          entering={reduced ? undefined : FadeIn.duration(duration.fast)}
          style={styles.readout}
        >
          {current.toFixed(1)}
        </Animated.Text>
        <Text style={styles.unit}>/ 255</Text>
        <View style={styles.flex} />
        <Text style={styles.stageName} numberOfLines={1}>
          {stageSet.stages[index]?.title ?? ''}
        </Text>
      </View>

      <View style={styles.stageChips}>
        {stageSet.values.map((value, stage) => {
          const active = stage === index;
          return (
            <MorphPressable
              key={stage}
              accessibilityLabel={`Show stage ${stage + 1}, value ${value.toFixed(1)}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSeek(stage)}
              restRadius={radius.pill}
              pressedRadius={radius.pill}
              style={[styles.stageChip, active && styles.stageChipActive]}
            >
              <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>
                {`${String(stage + 1).padStart(2, '0')} · ${value.toFixed(1)}`}
              </Text>
            </MorphPressable>
          );
        })}
      </View>

      {paramLine ? (
        <Text numberOfLines={1} style={styles.params}>
          {paramLine}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function CodePanel({ code, reduced }: { code: string | null; reduced: boolean }) {
  const [revealed, setRevealed] = useState(reduced ? (code?.length ?? 0) : 0);

  useEffect(() => {
    if (!code || reduced || revealed >= code.length) return;
    const timer = setTimeout(() => {
      setRevealed((count) => Math.min(code.length, count + labMotion.codeCharsPerTick));
    }, labMotion.codeCharMs);
    return () => clearTimeout(timer);
  }, [code, reduced, revealed]);

  if (!code) {
    return (
      <View style={styles.bodyContent}>
        <Text style={styles.empty}>No code excerpt for this operation.</Text>
      </View>
    );
  }

  const typing = revealed < code.length;

  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeHead}>
        <Text style={styles.label}>PYTHON · SIMPLIFIED EXCERPT</Text>
        <MorphPressable
          accessibilityLabel="Replay the code typing"
          onPress={() => setRevealed(0)}
          restRadius={radius.pill}
          pressedRadius={radius.pill}
          style={styles.replay}
        >
          <RotateCcw color={color.text.secondary} size={12} strokeWidth={1.75} />
          <Text style={styles.replayText}>Replay</Text>
        </MorphPressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.codeContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.codeScroll}
      >
        <Text selectable style={styles.code}>
          {code.slice(0, revealed)}
          {typing ? '▍' : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

function ArabicPanel({ opId }: { opId: string }) {
  return (
    <ScrollView
      contentContainerStyle={styles.arabicContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={styles.body}
    >
      <ArabicOperationContent opId={opId} />
    </ScrollView>
  );
}

export function MathPanel({
  stageSet,
  index,
  position,
  onSeek,
  params,
  reduced,
  compact,
  height,
}: Props) {
  const [tab, setTab] = useState<'maths' | 'code' | 'arabic'>(TAB_MATHS);
  const code = codeExcerpt(stageSet.opId);

  return (
    <View style={[styles.card, compact && styles.cardCompact, height ? { height } : null]}>
      <View style={styles.tabs}>
        <LabPill active={tab === 'maths'} label="Maths" onPress={() => setTab(TAB_MATHS)} />
        <LabPill active={tab === 'code'} label="Code" onPress={() => setTab(TAB_CODE)} />
        <LabPill
          active={tab === 'arabic'}
          arabic
          label="عربي"
          onPress={() => setTab(TAB_ARABIC)}
        />
        <View style={styles.flex} />
        <Text style={styles.tabHint}>{`${stageSet.stages.length} stages`}</Text>
      </View>

      {tab === 'maths' ? (
        <MathsPanel
          index={index}
          onSeek={onSeek}
          params={params}
          position={position}
          reduced={reduced}
          stageSet={stageSet}
        />
      ) : tab === 'code' ? (
        <CodePanel code={code} reduced={reduced} />
      ) : (
        <ArabicPanel opId={stageSet.opId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 176,
    marginTop: space[3],
    paddingTop: space[3],
    paddingHorizontal: space[3],
    paddingBottom: space[2],
    borderRadius: radius.lg,
    backgroundColor: color.bg[1],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
  },
  cardCompact: { minHeight: 160 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  tabHint: { fontFamily: font.mono, ...type.mono, color: color.text.tertiary },
  flex: { flex: 1 },
  body: { flex: 1, marginTop: space[1] },
  bodyContent: { paddingTop: space[2], paddingBottom: space[2] },
  arabicContent: { paddingTop: space[2], paddingBottom: space[2], gap: space[2] },
  label: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
  },
  formula: {
    fontFamily: font.mono,
    ...type.mono,
    color: color.text.primary,
    marginTop: space[1],
  },
  plotHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
  },
  coord: { fontFamily: font.mono, ...type.mono, color: color.text.tertiary },
  plotBed: {
    marginTop: space[1],
    borderRadius: radius.sm,
    backgroundColor: color.bg[0],
    overflow: 'hidden',
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    marginTop: space[2],
  },
  readout: { fontFamily: font.mono, ...type.title, color: color.text.primary },
  unit: { fontFamily: font.mono, ...type.mono, color: color.text.tertiary },
  stageName: {
    flexShrink: 1,
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.secondary,
  },
  stageChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1],
    marginTop: space[2],
  },
  stageChip: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    backgroundColor: color.bg[2],
  },
  stageChipActive: { backgroundColor: color.accent.ink },
  stageChipText: { fontFamily: font.mono, ...type.mono, color: color.text.secondary },
  stageChipTextActive: { color: color.text.onAccent },
  params: {
    fontFamily: font.mono,
    ...type.mono,
    color: color.text.tertiary,
    marginTop: space[2],
  },
  codeWrap: { flex: 1, marginTop: space[2] },
  codeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[2],
  },
  codeScroll: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: color.bg[0],
  },
  codeContent: { padding: space[3] },
  code: { fontFamily: font.mono, ...type.mono, color: color.text.primary },
  replay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    backgroundColor: color.bg[2],
  },
  replayText: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  empty: {
    fontFamily: font.body,
    ...type.body,
    color: color.text.tertiary,
    paddingVertical: space[4],
  },
});
