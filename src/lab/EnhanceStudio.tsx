/**
 * EnhanceStudio — Lab screen 8 (PLAN §3.8 / W3.5).
 *
 * One practical pipeline, four steps, one place: white balance → denoise →
 * CLAHE → unsharp mask. Each step is a chip in a stepper; tapping a chip
 * shows that step's **before → after** on the user's photo with the same
 * liquid seam the Histogram Surgery uses, and the step can be switched on or
 * off.
 *
 * The pipeline keeps a **stage cache**: the buffer after every step is kept,
 * so the chips never recompute anything and a step can be inspected without
 * touching the pipeline. Only a parameter or an on/off change re-runs the
 * stages from the first affected step.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SkImage } from '@shopify/react-native-skia';
import { ArrowLeft, Info, WandSparkles } from 'lucide-react-native';
import { color, font, radius, space, type } from '@/core/tokens';
import { goBack } from '@/core/navigation';
import {
  EngineCancelledError,
  getOperation,
  type ImageBuffer,
} from '@/engine';
import { imageBufferToSkImage } from '@/engine/bridge/skia';
import { runOperationAsync } from '@/engine/exec';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSlider } from '@/morph/MorphSlider';
import { MorphSurface } from '@/morph/MorphSurface';
import { useSharedValue } from 'react-native-reanimated';
import { usePhotoStore } from '@/library/photoStore';
import { ExplainSheet } from './components/ExplainSheet';
import { LabPill } from './components/LabPill';
import { LiquidCompare } from './components/LiquidCompare';
import { PhotoChooser } from './components/PhotoChooser';
import { createImagePool } from './imagePool';
import { useLabSource } from './useLabSource';
import { EnhanceArabicGuide } from './arabicGuides';

const PROXY_EDGE = 384;
const DEBOUNCE_MS = 150;

type StepId = 'whiteBalance' | 'denoise' | 'clahe' | 'sharpen';

type StepDef = {
  id: StepId;
  label: string;
  opId: string;
  /** Default parameters for the registry operation. */
  params: Record<string, number>;
  /** Which parameter the step exposes as its single slider. */
  slider: { key: string; label: string; min: number; max: number };
  /** One short line: what the step is for (and when it hurts). */
  note: string;
};

const STEPS: StepDef[] = [
  {
    id: 'whiteBalance',
    label: 'White balance',
    opId: 'grayWorldWB',
    params: { strength: 1 },
    slider: { key: 'strength', label: 'Strength', min: 0, max: 1 },
    note: 'removes a colour cast',
  },
  {
    id: 'denoise',
    label: 'Denoise',
    opId: 'bilateralFilter',
    params: { sigmaSpatial: 2, sigmaRange: 20 },
    slider: { key: 'sigmaRange', label: 'Range σ', min: 10, max: 60 },
    note: 'removes grain, keeps the edges',
  },
  {
    id: 'clahe',
    label: 'CLAHE',
    opId: 'clahe',
    params: { tiles: 8, clip: 3 },
    slider: { key: 'clip', label: 'Clip limit', min: 1, max: 8 },
    note: 'local contrast — can look harsh, so it starts off',
  },
  {
    id: 'sharpen',
    label: 'Sharpen',
    opId: 'unsharpMask',
    params: { amount: 1, radius: 1.4 },
    slider: { key: 'amount', label: 'Amount', min: 0, max: 2 },
    note: 'brings the detail back',
  },
];

/** One pipeline run: the source plus the buffer after every step. */
type StageCache = ImageBuffer[];

export function EnhanceStudio() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const latestId = usePhotoStore((state) => state.order[0]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const activeId = chosenId ?? latestId ?? null;
  const source = useLabSource(PROXY_EDGE, activeId ?? undefined);

  // CLAHE starts off: it is a local-contrast tool and on a normal phone photo
  // it blows out the shadows and looks broken (owner, 2026-10-21).
  const [enabled, setEnabled] = useState<Record<StepId, boolean>>({
    whiteBalance: true,
    denoise: true,
    clahe: false,
    sharpen: true,
  });
  const [params, setParams] = useState<Record<StepId, Record<string, number>>>(() => ({
    whiteBalance: { strength: 0.3 },
    denoise: { sigmaSpatial: 2, sigmaRange: 20 },
    clahe: { tiles: 8, clip: 2 },
    sharpen: { amount: 0.5, radius: 1.2 },
  }));
  const [selected, setSelected] = useState<StepId | 'result'>('result');
  const [stages, setStages] = useState<StageCache | null>(null);
  const [effects, setEffects] = useState<ImageBuffer[]>([]);
  const [display, setDisplay] = useState<{ before: SkImage; after: SkImage } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainId, setExplainId] = useState<string | null>(null);

  const sliderShared = useSharedValue(0);
  /** Owns the GPU image lifetimes (see `imagePool`). */
  const pool = useMemo(() => createImagePool(), []);
  const runSeq = useRef(0);
  const displayRef = useRef<{ before: SkImage; after: SkImage } | null>(null);
  /** The last pipeline run, so a change can resume from the first dirty step. */
  const cacheRef = useRef<{
    source: ImageBuffer;
    enabled: Record<StepId, boolean>;
    params: Record<StepId, Record<string, number>>;
    stages: StageCache;
    effects: ImageBuffer[];
  } | null>(null);

  const stepIndex = selected === 'result' ? -1 : STEPS.findIndex((step) => step.id === selected);
  const selectedStep = stepIndex >= 0 ? STEPS[stepIndex] : null;

  // Free the GPU copies when the screen goes away.
  useEffect(() => {
    return () => {
      runSeq.current += 1;
      pool.disposeAll();
      const current = displayRef.current;
      displayRef.current = null;
      current?.before.dispose();
      current?.after.dispose();
    };
  }, [pool]);

  // The pipeline: every enabled step runs in order and each output is cached,
  // so the stepper can show any step's before/after for free.
  //
  // The cache is also *resumed*: when only the last step changed, the first
  // three stages are reused instead of being recomputed from the source.
  useEffect(() => {
    if (!source.buffer) return;
    const src = source.buffer;
    const seq = ++runSeq.current;
    const shouldCancel = () => seq !== runSeq.current;

    const timer = setTimeout(() => {
      setBusy(true);
      void (async () => {
        try {
          const cached = cacheRef.current;
          const reusable = cached && cached.source === src;
          // First step whose parameters or on/off state changed.
          let start = 0;
          if (reusable && cached) {
            for (let i = 0; i < STEPS.length; i += 1) {
              const step = STEPS[i];
              if (
                cached.enabled[step.id] !== enabled[step.id] ||
                cached.params[step.id] !== params[step.id]
              ) {
                start = i;
                break;
              }
            }
          }

          // Two lists: `cache` is the pipeline the user actually sees (a
          // switched-off step is skipped), `effects` holds every step's own
          // output so a chip can still show what that step *would* do.
          const cache: StageCache = reusable && cached ? [...cached.stages] : [src];
          const effects: ImageBuffer[] = reusable && cached ? [...cached.effects] : [];
          let current = cache[start] ?? src;
          for (let i = start; i < STEPS.length; i += 1) {
            const step = STEPS[i];
            const out = await runOperationAsync(step.opId, current, params[step.id], {
              shouldCancel,
            });
            if (shouldCancel()) return;
            effects[i] = out;
            if (enabled[step.id]) current = out;
            cache[i + 1] = current;
          }
          if (shouldCancel()) return;
          cacheRef.current = { source: src, enabled, params, stages: cache, effects };
          setStages(cache);
          setEffects(effects);
        } catch (caught: unknown) {
          if (!(caught instanceof EngineCancelledError) && !shouldCancel()) {
            setError(caught instanceof Error ? caught.message : 'Could not run the pipeline');
          }
        } finally {
          if (!shouldCancel()) setBusy(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (runSeq.current === seq) runSeq.current += 1;
    };
  }, [enabled, params, source.buffer]);

  // The visible pair: the source → the pipeline result, or one step's
  // before → after.
  const beforeBuffer = useMemo(() => {
    if (!stages) return null;
    if (stepIndex < 0) return stages[0] ?? null;
    return stages[stepIndex] ?? null;
  }, [stepIndex, stages]);
  const afterBuffer = useMemo(() => {
    if (!stages) return null;
    if (stepIndex < 0) return stages[stages.length - 1] ?? null;
    // The step's own result, even when the step is switched off, so the chip
    // still shows what that step does.
    return effects[stepIndex] ?? stages[stepIndex + 1] ?? null;
  }, [effects, stepIndex, stages]);

  // Build the two Skia images for the comparison whenever the pair changes.
  useEffect(() => {
    if (!beforeBuffer || !afterBuffer) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const before = imageBufferToSkImage(beforeBuffer);
      const after = imageBufferToSkImage(afterBuffer);
      if (!before || !after) {
        before?.dispose();
        after?.dispose();
        return;
      }
      if (cancelled) {
        before.dispose();
        after.dispose();
        return;
      }
      const next = { before, after };
      const previous = displayRef.current;
      displayRef.current = next;
      setDisplay(next);
      if (previous) {
        pool.retire(previous.before);
        pool.retire(previous.after);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [afterBuffer, beforeBuffer, pool]);

  // Keep the slider in step with the selected step.
  useEffect(() => {
    if (!selectedStep) return;
    const { key, min, max } = selectedStep.slider;
    const value = params[selectedStep.id][key] ?? min;
    sliderShared.value = max > min ? (value - min) / (max - min) : 0;
  }, [params, selectedStep, sliderShared]);

  const onSliderCommit = useCallback(
    (value: number) => {
      if (!selectedStep) return;
      const { key, min, max } = selectedStep.slider;
      const next = min + value * (max - min);
      setParams((current) => ({
        ...current,
        [selectedStep.id]: { ...current[selectedStep.id], [key]: next },
      }));
    },
    [selectedStep],
  );

  const toggleStep = useCallback((id: StepId) => {
    setEnabled((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const runAuto = useCallback(() => {
    // Deliberately gentle: a strong white balance tints the photo and a
    // strong blur costs detail, which made "Auto enhance" look like damage.
    setParams({
      whiteBalance: { strength: 0.3 },
      denoise: { sigmaSpatial: 2, sigmaRange: 18 },
      clahe: { tiles: 8, clip: 2 },
      sharpen: { amount: 0.5, radius: 1.2 },
    });
    setEnabled({
      whiteBalance: true,
      denoise: true,
      clahe: false,
      sharpen: true,
    });
  }, []);

  const sliderWidth = width - space[4] * 2 - space[6];
  const stepCaption = selectedStep
    ? `${selectedStep.label} · ${enabled[selectedStep.id] ? 'in the pipeline' : 'switched off'}`
    : 'Whole pipeline';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <MorphPressable
          accessibilityLabel="Back"
          onPress={() => goBack(router)}
          style={styles.headerButton}
        >
          <ArrowLeft size={20} color={color.text.primary} />
        </MorphPressable>
        <Text style={styles.title}>Enhance Studio</Text>
        <MorphPressable
          accessibilityLabel="Explain the selected step"
          onPress={() => setExplainId(selectedStep?.opId ?? 'grayWorldWB')}
          style={styles.headerButton}
        >
          <Info size={20} color={color.text.primary} />
        </MorphPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PhotoChooser caption={source.label} onSelect={setChosenId} selectedId={activeId} />

        <View style={styles.stepRow}>
          <LabPill
            active={selected === 'result'}
            label="Result"
            onPress={() => setSelected('result')}
          />
          {STEPS.map((step, index) => (
            <LabPill
              key={step.id}
              active={selected === step.id}
              label={`${index + 1} ${step.label}`}
              onPress={() => setSelected(step.id)}
            />
          ))}
        </View>

        <LiquidCompare
          after={display?.after ?? null}
          aspectRatio={source.buffer ? source.buffer.width / source.buffer.height : 4 / 3}
          before={display?.before ?? null}
          busy={busy}
          maxHeight={280}
          testID="enhance-compare"
        />
        <Text style={styles.caption}>
          {`${stepCaption} · drag the seam to see the step's own effect`}
        </Text>

        <MorphSurface borderRadius={radius.md} level={1} style={styles.controls}>
          <View style={styles.controlHead}>
            <Text style={styles.sectionLabel}>{selectedStep?.label ?? 'Pipeline'}</Text>
            <LabPill active={false} label="Auto enhance" onPress={runAuto} />
          </View>

          {selectedStep ? (
            <>
              <View style={styles.pills}>
                <LabPill
                  active={enabled[selectedStep.id]}
                  label={enabled[selectedStep.id] ? 'Step is on' : 'Step is off'}
                  onPress={() => toggleStep(selectedStep.id)}
                />
                <LabPill
                  active={false}
                  label="Trace this step"
                  onPress={() =>
                    router.push({
                      pathname: '/explain/[op]',
                      params: {
                        op: selectedStep.opId,
                        ...(activeId ? { id: activeId } : {}),
                        ...Object.fromEntries(
                          Object.entries(params[selectedStep.id]).map(([key, value]) => [
                            key,
                            String(value),
                          ]),
                        ),
                      },
                    })
                  }
                />
              </View>
              <View style={styles.sliderHead}>
                <Text style={styles.sliderLabel}>{selectedStep.slider.label}</Text>
                <Text style={styles.mono}>
                  {(params[selectedStep.id][selectedStep.slider.key] ?? 0).toFixed(2)}
                </Text>
              </View>
              <MorphSlider
                label={selectedStep.slider.label}
                onCommit={onSliderCommit}
                value={sliderShared}
                width={Math.max(80, sliderWidth)}
              />
              <Text style={styles.caption}>{selectedStep.note}</Text>
              {selectedStep.id === 'clahe' ? (
                <View style={styles.pills}>
                  {[4, 8, 16].map((tiles) => (
                    <LabPill
                      key={tiles}
                      active={params.clahe.tiles === tiles}
                      label={`${tiles}×${tiles} tiles`}
                      onPress={() =>
                        setParams((current) => ({
                          ...current,
                          clahe: { ...current.clahe, tiles },
                        }))
                      }
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.body}>
              White balance → denoise → CLAHE → sharpen. Tap a step to see it on your photo.
            </Text>
          )}
        </MorphSurface>

        <View style={styles.pills}>
          {STEPS.map((step) => (
            <LabPill
              key={`on-${step.id}`}
              active={enabled[step.id]}
              label={`${step.label}: ${enabled[step.id] ? 'on' : 'off'}`}
              onPress={() => toggleStep(step.id)}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <EnhanceArabicGuide />

        <View style={styles.bottomRow}>
          <LabPill active={false} label="Back to Lab" onPress={() => router.push('/lab')} />
          <MorphPressable
            accessibilityLabel="Auto enhance"
            onPress={runAuto}
            style={styles.resetButton}
          >
            <WandSparkles size={16} color={color.text.secondary} />
            <Text style={styles.caption}>Auto enhance</Text>
          </MorphPressable>
        </View>
      </ScrollView>

      <ExplainSheet
        onClose={() => setExplainId(null)}
        operation={explainId ? getOperation(explainId) : null}
        visible={explainId !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg[0] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  headerButton: { padding: space[2] },
  title: { fontFamily: font.title, ...type.title, color: color.text.primary },
  content: { padding: space[4], paddingBottom: space[14], gap: space[3] },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  caption: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
  body: { fontFamily: font.body, ...type.body, color: color.text.secondary },
  sectionLabel: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
  },
  controls: { padding: space[3], gap: space[3] },
  controlHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sliderLabel: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  mono: { fontFamily: font.mono, ...type.mono, color: color.text.primary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.semantic.danger,
    borderRadius: radius.sm,
    padding: space[2],
    backgroundColor: color.bg[1],
  },
  errorText: { fontFamily: font.body, ...type.caption, color: color.semantic.danger },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetButton: { flexDirection: 'row', alignItems: 'center', gap: space[1], padding: space[2] },
});
