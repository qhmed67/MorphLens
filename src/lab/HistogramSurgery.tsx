/**
 * HistogramSurgery — Lab screen 3 (PLAN §3.3 / W3.1–W3.2).
 *
 * The left half of the photo is the untouched source; the right half is the
 * selected point operation. A live 64-bin histogram and CDF sit above the
 * comparison, so the normally invisible redistribution of tones is the star:
 * equalise spreads the pile-up, CLAHE lifts local tiles, stretch opens the
 * observed min..max, and the curve editor lets the learner bend that mapping
 * by hand.
 *
 * Performance follows the Lab rule: 512 px proxy for display, 96 px analysis
 * for the plot, a 150 ms debounce, and `runOperationAsync` for CLAHE so the
 * slider never blocks the UI thread.
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
import { ArrowLeft, Info, RotateCcw } from 'lucide-react-native';
import { color, font, radius, space, type } from '@/core/tokens';
import { goBack } from '@/core/navigation';
import {
  applyLut,
  cdf,
  EngineCancelledError,
  getOperation,
  histogram,
  type ImageBuffer,
} from '@/engine';
import { imageBufferToSkImage } from '@/engine/bridge/skia';
import { runOperationAsync } from '@/engine/exec';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSlider } from '@/morph/MorphSlider';
import { MorphSurface } from '@/morph/MorphSurface';
import { useSharedValue } from 'react-native-reanimated';
import { usePhotoStore } from '@/library/photoStore';
import { boxDownsample } from './source';
import { ExplainSheet } from './components/ExplainSheet';
import { HistogramPlot } from './components/HistogramPlot';
import { LabPill } from './components/LabPill';
import { LiquidCompare } from './components/LiquidCompare';
import { PhotoChooser } from './components/PhotoChooser';
import { ToneCurve } from './components/ToneCurve';
import {
  buildToneLut,
  TONE_IDENTITY,
  TONE_PRESETS,
  type TonePoints,
} from './toneCurve';
import { createImagePool } from './imagePool';
import { useLabSource } from './useLabSource';
import { HistogramArabicGuide } from './arabicGuides';

const METHODS = [
  { id: 'equalize', label: 'Equalize', opId: 'equalize', note: 'One global CDF map' },
  { id: 'clahe', label: 'CLAHE', opId: 'clahe', note: 'Local tiles, clipped peaks' },
  { id: 'stretch', label: 'Stretch', opId: 'contrastStretch', note: 'Open min..max' },
  { id: 'curve', label: 'Curve', opId: 'equalize', note: 'Your own LUT' },
] as const;

type Method = (typeof METHODS)[number]['id'];
type Render = { source: ImageBuffer; buffer: ImageBuffer; image: SkImage };

const ANALYSIS_EDGE = 96;
const DISPLAY_EDGE = 512;
const DEBOUNCE_MS = 150;

export function HistogramSurgery() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const latestId = usePhotoStore((state) => state.order[0]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const activeId = chosenId ?? latestId ?? null;
  const source = useLabSource(DISPLAY_EDGE, activeId ?? undefined);

  const [method, setMethod] = useState<Method>('equalize');
  const [rangeMode, setRangeMode] = useState(0);
  const [clip, setClip] = useState(3);
  const [tiles, setTiles] = useState(8);
  const [curvePoints, setCurvePoints] = useState<TonePoints>(TONE_IDENTITY);
  const [presetId, setPresetId] = useState('linear');
  const [render, setRender] = useState<Render | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  const clipShared = useSharedValue((3 - 1) / 7);
  /** Owns the GPU image lifetimes (see `imagePool`). */
  const pool = useMemo(() => createImagePool(), []);
  const renderRef = useRef<Render | null>(null);
  const runSeq = useRef(0);

  const methodInfo = METHODS.find((entry) => entry.id === method) ?? METHODS[0];
  const currentOp = useMemo(() => getOperation(methodInfo.opId), [methodInfo.opId]);
  const curveLut = useMemo(() => buildToneLut(curvePoints), [curvePoints]);

  const analysis = useMemo(
    () => (source.buffer ? boxDownsample(source.buffer, ANALYSIS_EDGE) : null),
    [source.buffer],
  );
  const beforeHist = useMemo(() => (analysis ? histogram(analysis, 64) : null), [analysis]);
  const visibleRender =
    render && source.buffer && render.source === source.buffer ? render : null;
  const afterAnalysis = useMemo(
    () => (visibleRender ? boxDownsample(visibleRender.buffer, ANALYSIS_EDGE) : null),
    [visibleRender],
  );
  const afterHist = useMemo(
    () => (afterAnalysis ? histogram(afterAnalysis, 64) : null),
    [afterAnalysis],
  );
  const beforeCdf = useMemo(
    () => (beforeHist ? cdf(beforeHist.luma) : undefined),
    [beforeHist],
  );
  const afterCdf = useMemo(
    () => (afterHist ? cdf(afterHist.luma) : undefined),
    [afterHist],
  );

  // Keep the current GPU copy alive until the next one is on screen.
  useEffect(() => {
    return () => {
      runSeq.current += 1;
      pool.disposeAll();
      renderRef.current?.image.dispose();
      renderRef.current = null;
    };
  }, [pool]);

  // Debounced engine pipeline. A new run owns the screen; superseded runs are
  // cancelled by the sequence check, including the one-frame executor yield.
  useEffect(() => {
    if (!source.buffer) return;
    const src = source.buffer;
    const seq = ++runSeq.current;
    const shouldCancel = () => seq !== runSeq.current;
    const params: Record<string, number> =
      method === 'clahe'
        ? { tiles, clip }
        : method === 'equalize' || method === 'stretch'
          ? { mode: rangeMode }
          : {};

    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          const out =
            method === 'curve'
              ? applyLut(src, curveLut)
              : await runOperationAsync(methodInfo.opId, src, params, { shouldCancel });
          if (shouldCancel()) return;
          const image = imageBufferToSkImage(out);
          if (!image) throw new Error('Skia rejected the histogram preview');
          if (shouldCancel()) {
            image.dispose();
            return;
          }
          const next = { source: src, buffer: out, image };
          const previous = renderRef.current;
          renderRef.current = next;
          setRender(next);
          if (previous) pool.retire(previous.image);
        } catch (caught: unknown) {
          if (!(caught instanceof EngineCancelledError) && !shouldCancel()) {
            setError(caught instanceof Error ? caught.message : 'Could not build this preview');
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
  }, [clip, curveLut, method, methodInfo.opId, pool, rangeMode, source.buffer, tiles]);

  const onClipCommit = useCallback((value: number) => {
    const next = Math.min(8, Math.max(1, 1 + value * 7));
    setClip(Math.round(next * 2) / 2);
  }, []);

  const onCurveChange = useCallback((next: TonePoints) => {
    setCurvePoints(next);
    setPresetId('custom');
  }, []);

  const onPreset = useCallback((id: string) => {
    const preset = TONE_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;
    setCurvePoints(preset.points);
    setPresetId(id);
  }, []);

  const sliderWidth = width - space[4] * 2 - space[6];
  const compareHeight = height < 760 ? 250 : 330;
  const explanationExtra =
    method === 'curve' ? (
      <Text style={styles.body}>
        The curve is a custom LUT: the five control points are joined by straight segments,
        then each of the 256 input levels is looked up in that table. No neighbourhood is
        involved — only the value at the same pixel changes.
      </Text>
    ) : null;

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
        <Text style={styles.title}>Histogram Surgery</Text>
        <MorphPressable
          accessibilityLabel="Explain the selected tone mapping"
          onPress={() => setExplainOpen(true)}
          style={styles.headerButton}
        >
          <Info size={20} color={color.text.primary} />
        </MorphPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PhotoChooser caption={source.label} onSelect={setChosenId} selectedId={activeId} />

        <MorphSurface borderRadius={radius.md} level={1} style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.sectionLabel}>Luma histogram · 64 bins</Text>
              <Text style={styles.caption}>Analysis at {ANALYSIS_EDGE} px</Text>
            </View>
            <View style={styles.cdfKey}>
              <View style={styles.cdfSwatch} />
              <Text style={styles.caption}>CDF</Text>
            </View>
          </View>
          <HistogramPlot
            after={afterHist?.luma ?? beforeHist?.luma ?? new Uint32Array(64)}
            before={beforeHist?.luma ?? new Uint32Array(64)}
            cdfAfter={afterCdf}
            cdfBefore={beforeCdf}
            height={132}
            testID="histogram-plot"
          />
          <View style={styles.legend}>
            <Text style={styles.caption}>pale fill = before</Text>
            <Text style={styles.caption}>ink line = after</Text>
          </View>
        </MorphSurface>

        <View style={styles.pills}>
          {METHODS.map((entry) => (
            <LabPill
              key={entry.id}
              active={method === entry.id}
              label={entry.label}
              onPress={() => setMethod(entry.id)}
            />
          ))}
        </View>
        <Text style={styles.caption}>{methodInfo.note} · drag the seam to compare</Text>

        <LiquidCompare
          after={visibleRender?.image ?? null}
          aspectRatio={source.buffer ? source.buffer.width / source.buffer.height : 4 / 3}
          before={source.image}
          busy={busy}
          maxHeight={compareHeight}
          testID="histogram-compare"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <MorphSurface borderRadius={radius.md} level={1} style={styles.controls}>
          <View style={styles.controlHead}>
            <Text style={styles.sectionLabel}>{methodInfo.label} controls</Text>
            <Text style={styles.caption}>
              {method === 'clahe'
                ? `clip ${clip.toFixed(1)} · ${tiles}×${tiles} tiles`
                : method === 'curve'
                  ? `${presetId} curve`
                  : rangeMode === 0
                    ? 'luma-preserving'
                    : 'per channel'}
            </Text>
          </View>

          {(method === 'equalize' || method === 'stretch') && (
            <View style={styles.pills}>
              <LabPill
                active={rangeMode === 0}
                label="Luma"
                onPress={() => setRangeMode(0)}
              />
              <LabPill
                active={rangeMode === 1}
                label="RGB channels"
                onPress={() => setRangeMode(1)}
              />
            </View>
          )}

          {method === 'clahe' && (
            <>
              <View style={styles.pills}>
                {[4, 8, 16].map((value) => (
                  <LabPill
                    key={value}
                    active={tiles === value}
                    label={`${value}×${value}`}
                    onPress={() => setTiles(value)}
                  />
                ))}
              </View>
              <View style={styles.sliderHead}>
                <Text style={styles.sliderLabel}>Clip limit</Text>
                <Text style={styles.mono}>{clip.toFixed(1)}</Text>
              </View>
              <MorphSlider
                label="CLAHE clip limit"
                onCommit={onClipCommit}
                value={clipShared}
                width={Math.max(80, sliderWidth)}
              />
              <Text style={styles.caption}>
                A lower clip keeps local peaks from exploding; a higher clip gives more
                local contrast and more noise.
              </Text>
            </>
          )}

          {method === 'curve' && (
            <>
              <View style={styles.pills}>
                {TONE_PRESETS.map((preset) => (
                  <LabPill
                    key={preset.id}
                    active={presetId === preset.id}
                    label={preset.label}
                    onPress={() => onPreset(preset.id)}
                  />
                ))}
              </View>
              <ToneCurve
                height={168}
                onChange={onCurveChange}
                points={curvePoints}
                testID="tone-curve"
              />
              <View style={styles.curveFooter}>
                <Text style={styles.caption}>Drag a point up for brighter output.</Text>
                <LabPill
                  active={false}
                  label="Reset"
                  onPress={() => onPreset('linear')}
                />
              </View>
            </>
          )}

          {method !== 'curve' ? (
            <View style={styles.actions}>
              <LabPill
                active={false}
                label="Open Trace"
                onPress={() =>
                  router.push({
                    pathname: '/explain/[op]',
                    params: {
                      op: methodInfo.opId,
                      ...(activeId ? { id: activeId } : {}),
                      ...(method === 'clahe'
                        ? { tiles: String(tiles), clip: String(clip) }
                        : { mode: String(rangeMode) }),
                    },
                  })
                }
              />
              <LabPill
                active={false}
                label="Explain"
                onPress={() => setExplainOpen(true)}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <Text style={styles.caption}>
                This mapping is not a registry operation yet; try Equalize for the same
                idea with an automatic CDF.
              </Text>
            </View>
          )}
        </MorphSurface>

        <HistogramArabicGuide />

        <View style={styles.bottomRow}>
          <LabPill
            active={false}
            label="Back to Lab"
            onPress={() => router.push('/lab')}
          />
          <MorphPressable
            accessibilityLabel="Reset curve"
            onPress={() => onPreset('linear')}
            style={styles.resetButton}
          >
            <RotateCcw size={16} color={color.text.secondary} />
            <Text style={styles.caption}>Reset curve</Text>
          </MorphPressable>
        </View>
      </ScrollView>

      <ExplainSheet
        onClose={() => setExplainOpen(false)}
        operation={currentOp}
        visible={explainOpen}
      >
        {explanationExtra}
      </ExplainSheet>
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
  card: { padding: space[3], gap: space[2] },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionLabel: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
  body: { fontFamily: font.body, ...type.body, color: color.text.secondary },
  cdfKey: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  cdfSwatch: { width: 14, height: 1, backgroundColor: color.accent.ink },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  controls: { padding: space[3], gap: space[3] },
  controlHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sliderHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sliderLabel: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  mono: { fontFamily: font.mono, ...type.mono, color: color.text.primary },
  curveFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.semantic.danger,
    borderRadius: radius.sm,
    padding: space[2],
    backgroundColor: color.bg[1],
  },
  errorText: { fontFamily: font.body, ...type.caption, color: color.semantic.danger },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    padding: space[2],
  },
});
