/**
 * KernelTheatre — Lab screen 1, "Convolution Explainer" (PLAN §3.1 / W2.11).
 *
 * A 16×16 proxy of the source is magnified into a pixel grid; a glowing 3×3
 * kernel window sweeps it row-major while the matching output cell pops into
 * the result grid on the right. The border ring appears first — border mode is
 * a decision, not an accident — then the interior computes as the sweep runs.
 * The term readout (w·v sums on luma) updates once per sweep cell via a
 * worklet reaction, never per frame, so React stays out of the loop
 * (SKILL §1 rule 1). The full convolve result is computed once per kernel
 * edit through the engine's banded async executor, then replayed cheaply.
 *
 * Single Skia canvas pair, static node count (~10) — the sweep animates
 * derived values only, targeting the 55 fps Lab budget on mid-range Android.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Blur,
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  Paint,
  Path,
  Rect,
  RoundedRect,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, Info } from 'lucide-react-native';
import { labMotion } from '@/core/motion';
import { goBack } from '@/core/navigation';
import { scheduleOnRN } from '@/core/threads';
import { color, font, radius, space, type } from '@/core/tokens';
import { getOperation, type ImageBuffer } from '@/engine';
import { runOperationAsync } from '@/engine/exec';
import { imageBufferToSkImage } from '@/engine/bridge/skia';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSheet } from '@/morph/MorphSheet';
import { MorphSlider } from '@/morph/MorphSlider';
import { MorphSkeleton } from '@/morph/MorphSkeleton';
import { MorphSurface } from '@/morph/MorphSurface';
import { ArabicGuide } from './components/ArabicGuide';
import { ExplainSheet } from './components/ExplainSheet';
import { KernelEditor } from './components/KernelEditor';
import { MiniMatrix } from './components/MiniMatrix';
import { PhotoChooser } from './components/PhotoChooser';
import { BORDER_LABELS } from './borderModes';
import { convolveParams, defaultConvolveWeights } from './kernelInput';
import { useLabSource } from './useLabSource';
import { usePhotoStore } from '@/library/photoStore';

/** Magnified grid: 16×16 pixels (interior sweep positions are 14×14). */
const GRID = 16;
const INTERIOR = GRID - 2;
const CELL_COUNT = INTERIOR * INTERIOR;

/** Short decimal rendering for a kernel weight in the term readout. */
function trimWeight(value: number): string {
  return String(Math.round(value * 100) / 100);
}

type Patch = { col: number; row: number; rows: string[]; sum: number };

/** Map the speed slider (0..1, slow→fast) onto the sweep token range. */
function sweepDuration(speed: number): number {
  return (
    labMotion.sweep.slow +
    (labMotion.sweep.fast - labMotion.sweep.slow) * Math.min(1, Math.max(0, speed))
  );
}

export function KernelTheatre() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion() ?? false;
  const latestId = usePhotoStore((state) => state.order[0]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const activeId = chosenId ?? latestId ?? null;
  const source = useLabSource(384, activeId ?? undefined);

  const side = Math.floor((width - space[4] * 2 - space[2]) / 2);
  const cell = side / GRID;

  const [weights, setWeights] = useState<number[]>(defaultConvolveWeights);
  const [border, setBorder] = useState(0);
  const [speed, setSpeed] = useState(0.5);
  const [patch, setPatch] = useState<Patch | null>(null);
  const [result, setResult] = useState<SkImage | null>(null);
  /** True while the convolution runs: the panel shows a shimmer, never a black square. */
  const [busy, setBusy] = useState(true);
  const [kernelOpen, setKernelOpen] = useState(false);
  const [explainVisible, setExplainVisible] = useState(false);
  const [replayToken, setReplayToken] = useState(0);

  const sweep = useSharedValue(0);
  const speedShared = useSharedValue(0.5); // slider position lives on the UI thread
  const latestK = useRef(0);
  const bufferRef = useRef<ImageBuffer | null>(null);
  const weightsRef = useRef<number[]>(weights);
  // Two-generation image retention: the canvas may still reference the image
  // from the previous commit when the next convolution resolves. Disposing one
  // generation later avoids a black flash when switching kernels/borders.
  const resultRef = useRef<SkImage | null>(null);
  const previousResultRef = useRef<SkImage | null>(null);
  const mountedRef = useRef(true);
  // Refs mirror current props for the stable worklet callback; the effect is
  // declared before the readout re-emit so it runs first on every update.
  useEffect(() => {
    bufferRef.current = source.buffer;
    weightsRef.current = weights;
  }, [source.buffer, weights]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resultRef.current?.dispose();
      previousResultRef.current?.dispose();
      resultRef.current = null;
      previousResultRef.current = null;
    };
  }, []);

  // --- Compute -------------------------------------------------------------
  // One convolve per kernel/border edit via the banded executor (W2.10
  // policy); the seq guard drops stale results if edits arrive back-to-back.
  const runSeq = useRef(0);
  useEffect(() => {
    const buffer = source.buffer;
    if (!buffer) return;
    const seq = ++runSeq.current;
    const params = convolveParams(weights, border);
    // The badge flips in a microtask rather than in the effect body: the body
    // must stay free of synchronous state updates, and the executor yields a
    // frame before the work anyway.
    void Promise.resolve().then(() => {
      if (seq === runSeq.current) setBusy(true);
    });
    runOperationAsync('convolve', buffer, params)
      .then((out) => {
        const skImage = imageBufferToSkImage(out);
        if (!skImage) return;
        if (!mountedRef.current || seq !== runSeq.current) {
          skImage.dispose(); // a newer edit won; do not leak the stale image
          return;
        }
        setBusy(false);
        // Keep the previous frame alive for one more result, then release it.
        previousResultRef.current?.dispose();
        previousResultRef.current = resultRef.current;
        resultRef.current = skImage;
        setResult(skImage);
        setReplayToken((token) => token + 1);
      })
      .catch((error: unknown) => {
        if (seq === runSeq.current) {
          setBusy(false);
          Alert.alert('Convolution failed', String(error));
        }
      });
  }, [source.buffer, weights, border]);

  // --- Sweep playback ------------------------------------------------------
  // The loop length is a token (labMotion.sweep) mapped through the speed
  // slider; linear easing keeps the window's pace steady. Reduced motion
  // parks the sweep at the end: full reveal, no animation.
  useEffect(() => {
    sweep.value = 0;
    if (reduced) {
      sweep.value = 1;
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, { duration: sweepDuration(speed), easing: Easing.linear }),
      -1,
      false,
    );
  }, [speed, reduced, replayToken, sweep]);

  // --- Term readout --------------------------------------------------------
  // One reaction per swept cell (≈2 cells/s at defaults) → discrete React
  // updates, never per frame. Luma keeps the arithmetic to one number per
  // pixel while convolve itself runs per channel.
  const emitPatch = useCallback((k: number) => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    latestK.current = k;
    const col = 1 + (k % INTERIOR);
    const row = 1 + Math.floor(k / INTERIOR);
    const terms: { w: number; v: number }[] = [];
    for (let ky = 0; ky < 3; ky += 1) {
      for (let kx = 0; kx < 3; kx += 1) {
        const i = ((row + ky) * buffer.width + (col + kx)) * 4;
        const luma =
          0.299 * buffer.data[i] + 0.587 * buffer.data[i + 1] + 0.114 * buffer.data[i + 2];
        terms.push({ w: weightsRef.current[ky * 3 + kx], v: luma });
      }
    }
    const rows = [0, 1, 2].map((ky) =>
      terms
        .slice(ky * 3, ky * 3 + 3)
        .map((term) => `${trimWeight(term.w)}·${Math.round(term.v)}`)
        .join(' + '),
    );
    const sum = terms.reduce((total, term) => total + term.w * term.v, 0);
    setPatch({ col, row, rows, sum });
  }, []);

  const cellIndex = useDerivedValue(
    () => Math.min(CELL_COUNT - 1, Math.floor(sweep.value * CELL_COUNT)),
    [],
  );
  useAnimatedReaction(
    () => cellIndex.value,
    (current, previous) => {
      if (current !== previous) scheduleOnRN(emitPatch, current);
    },
    [emitPatch],
  );
  // Re-render the current terms when the kernel changes mid-sweep.
  useEffect(() => {
    emitPatch(latestK.current);
  }, [weights, emitPatch]);

  // --- Canvas geometry -----------------------------------------------------
  const gridPath = useMemo(() => {
    // Skia's paths are immutable in this version: build, then `build()`.
    const builder = Skia.PathBuilder.Make();
    for (let i = 0; i <= GRID; i += 1) {
      const p = Math.round(i * cell) + 0.5; // half-pixel offset → crisp hairlines
      builder.moveTo(p, 0);
      builder.lineTo(p, side);
      builder.moveTo(0, p);
      builder.lineTo(side, p);
    }
    return builder.build();
  }, [cell, side]);

  const windowX = useDerivedValue(() => (1 + (cellIndex.value % INTERIOR)) * cell, [cell]);
  const windowY = useDerivedValue(
    () => (1 + Math.floor(cellIndex.value / INTERIOR)) * cell,
    [cell],
  );
  const interiorRow = useDerivedValue(() => Math.floor(cellIndex.value / INTERIOR), []);
  const interiorCol = useDerivedValue(() => cellIndex.value % INTERIOR, []);
  const ringOpacity = useDerivedValue(() => (sweep.value > 0 ? 0 : 1), []);
  const currentRowY = useDerivedValue(() => (1 + interiorRow.value) * cell, [cell]);
  const rowRemainderX = useDerivedValue(() => (2 + interiorCol.value) * cell, [cell]);
  const rowRemainderW = useDerivedValue(() => (INTERIOR - 1 - interiorCol.value) * cell, [cell]);
  const belowY = useDerivedValue(() => (2 + interiorRow.value) * cell, [cell]);
  const belowH = useDerivedValue(() => (INTERIOR - 1 - interiorRow.value) * cell, [cell]);
  const seamX = useDerivedValue(() => (2 + interiorCol.value) * cell - cell * 0.125, [cell]);

  const convolveOp = getOperation('convolve');
  const sliderWidth = width - space[4] * 2;

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
        <Text style={styles.title}>Convolution Explainer</Text>
        <MorphPressable
          accessibilityLabel="Explain convolution"
          onPress={() => setExplainVisible(true)}
          style={styles.headerButton}
        >
          <Info size={20} color={color.text.primary} />
        </MorphPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PhotoChooser caption={source.label} onSelect={setChosenId} selectedId={activeId} />

        <View style={styles.panels}>
          <View>
            <Text style={styles.panelLabel}>Source · 16×16</Text>
            <View style={[styles.panel, { width: side, height: side }]}>
              <Canvas style={{ width: side, height: side }}>
                {source.image ? (
                  <SkiaImage
                    fit="fill"
                    height={side}
                    image={source.image}
                    sampling={{ filter: FilterMode.Nearest }}
                    width={side}
                    x={0}
                    y={0}
                  />
                ) : null}
                <Path path={gridPath} style="stroke" strokeWidth={0.5} color={color.photoStroke} />
                <RoundedRect
                  height={cell * 3}
                  r={cell * 0.3}
                  width={cell * 3}
                  x={windowX}
                  y={windowY}
                >
                  <Paint style="stroke" strokeWidth={2} color={color.accent.ink}>
                    <Blur blur={Math.max(2, cell * 0.5)} />
                  </Paint>
                </RoundedRect>
                <RoundedRect
                  height={cell * 3}
                  r={cell * 0.3}
                  style="stroke"
                  strokeWidth={1}
                  color={color.photoStrokeStrong}
                  width={cell * 3}
                  x={windowX}
                  y={windowY}
                />
              </Canvas>
            </View>
          </View>
          <View>
            <Text style={styles.panelLabel}>Output · reveal</Text>
            <View style={[styles.panel, { width: side, height: side }]}>
              {result ? (
              <Canvas style={{ width: side, height: side }}>
                {result ? (
                  <SkiaImage fit="fill" height={side} image={result} width={side} x={0} y={0} />
                ) : null}
                {/* No result yet: the covers below would read as a black
                    screen, so the panel shows a shimmer instead. */}
                {/* Border ring stays covered until the first sweep cell. */}
                <Group opacity={ringOpacity}>
                  <Rect height={cell} width={side} x={0} y={0} color={color.bg[1]} />
                  <Rect height={cell} width={side} x={0} y={side - cell} color={color.bg[1]} />
                  <Rect height={side} width={cell} x={0} y={0} color={color.bg[1]} />
                  <Rect height={side} width={cell} x={side - cell} y={0} color={color.bg[1]} />
                </Group>
                {/* Interior cover: rows below the sweep + the current row's tail. */}
                <Rect
                  height={belowH}
                  width={INTERIOR * cell}
                  x={cell}
                  y={belowY}
                  color={color.bg[1]}
                />
                <Rect
                  height={cell}
                  width={rowRemainderW}
                  x={rowRemainderX}
                  y={currentRowY}
                  color={color.bg[1]}
                />
                {/* Glowing frontier: the pixel about to be computed. */}
                <Group>
                  <Paint color={color.accent.ink}>
                    <Blur blur={Math.max(2, cell * 0.4)} />
                  </Paint>
                  <Rect
                    height={cell}
                    width={cell * 0.25}
                    x={seamX}
                    y={currentRowY}
                    color={color.photoStrokeStrong}
                  />
                </Group>
              </Canvas>
              ) : (
                <MorphSkeleton
                  borderRadius={radius.md}
                  height={side}
                  width={side}
                  testID="convolution-loading"
                />
              )}
              {busy ? (
                <View pointerEvents="none" style={styles.busyTag}>
                  <Text style={styles.busyText}>COMPUTING…</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.caption}>
          Border pixels ({BORDER_LABELS[border].toLowerCase()}) appear first — the interior computes
          as the kernel sweeps.
        </Text>

        <MorphSurface
          accessibilityLabel="Kernel term breakdown"
          borderRadius={radius.md}
          level={1}
          style={styles.sumCard}
        >
          <Text style={styles.sumLabel}>Σ = sum of 9 · weight × luma</Text>
          <Text style={styles.sumLegend}>
            w = weight from the 3×3 kernel · v = luma of the pixel under it · Σ = add all nine
            {patch ? ` · at (${patch.col}, ${patch.row})` : ''}
          </Text>
          {(
            patch?.rows ?? [
              '— · — + — · — + — · —',
              '— · — + — · — + — · —',
              '— · — + — · — + — · —',
            ]
          ).map((row, index) => (
            <Text key={index} style={styles.termRow}>
              {row}
            </Text>
          ))}
          <Text style={styles.sumValue}>{`Σ = ${patch ? patch.sum.toFixed(1) : '—'}`}</Text>
        </MorphSurface>

        <ArabicGuide subtitle="من البكسل للشاربنينج — الحكاية كلها" title="اشرح لي بالعربية">
          <View style={styles.arSection}>
            <Text style={styles.arHeading}>١ · الفكرة في سطر</Text>
            <Text style={styles.arText}>
              الشاربنينج مش بيرسم خطوط جديدة. هو بيزوّد الفرق اللي موجود أصلًا بين البكسل
              وجيرانه، فالحواف والخطوط تبان أوضح. عشان تفهم إزاي، محتاج تشوف الصورة زي
              الكمبيوتر.
            </Text>
          </View>

          <View style={styles.arSection}>
            <Text style={styles.arHeading}>٢ · الكمبيوتر بيشوف الصورة إزاي؟</Text>
            <Text style={styles.arText}>
              تخيل الصورة شبكة من المربعات الصغيرة (بكسلات). كل مربع فيه رقم للسطوع: 0 أسود
              خالص، و255 أبيض خالص. لو رتبنا الأرقام في جدول، ده اللي بنسميه مصفوفة. الصورة
              الملونة عندها 3 جداول — أحمر وأخضر وأزرق — وكلهم بيتحسبوا بنفس الطريقة.
            </Text>
            <Text style={styles.arText}>
              عشان نبسّط، هنشرح على جدول واحد للسطوع. الأرقام اللي تحت هي «الصورة» اللي
              الكمبيوتر شايفها:
            </Text>
            <View style={styles.arMatrices}>
              <View style={styles.arMatrixCol}>
                <Text style={styles.arCaption}>الصورة = أرقام سطوع</Text>
                <MiniMatrix
                  compact
                  highlightCenter
                  values={[
                    [20, 30, 40],
                    [30, 70, 50],
                    [40, 50, 60],
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.arSection}>
            <Text style={styles.arHeading}>٣ · يعني إيه «حافة»؟</Text>
            <Text style={styles.arText}>
              الحافة مش خط أسود كشكل؛ هي مكان فيه فرق كبير بين رقم بكسل ورقم اللي جنبه. لو كل
              الأرقام حواليها 70، مفيش حافة. لو في 70 جنب 20، فيه فرق — ده المكان اللي
              بنسميه حافة. الشاربنينج بيشتغل على الفرق ده، مش بيدوّر على «خط» بعينه.
            </Text>
          </View>

          <View style={styles.arSection}>
            <Text style={styles.arHeading}>٤ · إزاي الحسبة بتحصل؟</Text>
            <Text style={styles.arText}>
              بناخد مربع صغير 3×3 (اسمه kernel) ونحطه فوق جزء من الصورة. في كل وقفة: نضرب كل
              وزن في رقم البكسل اللي تحته، وبعدين نجمع التسعة. الناتج هو البكسل الجديد في
              النص. بعدها ننقل المربع بكسل واحد ونكرر على الصورة كلها. الحركة اللي فوق هي
              نفس الفكرة.
            </Text>
            <View style={styles.arMatrices}>
              <View style={styles.arMatrixCol}>
                <Text style={styles.arCaption}>المصفوفة (kernel)</Text>
                <MiniMatrix
                  compact
                  highlightCenter
                  values={[
                    [0, -1, 0],
                    [-1, 5, -1],
                    [0, -1, 0],
                  ]}
                />
              </View>
              <Text style={styles.arTimes}>×</Text>
              <View style={styles.arMatrixCol}>
                <Text style={styles.arCaption}>البكسلات (luma)</Text>
                <MiniMatrix
                  compact
                  highlightCenter
                  values={[
                    [20, 30, 40],
                    [30, 70, 50],
                    [40, 50, 60],
                  ]}
                />
              </View>
            </View>
            <View style={styles.arFormulaBox}>
              <Text style={styles.arFormula}>{'Σ = 5×70 − 30 − 30 − 50 − 50\n   = 190'}</Text>
            </View>
            <Text style={styles.arText}>
              المركز وزنه 5 (بنكبّر البكسل)، والجيران أوزانهم −1 (بنطرحهم). البكسل اللي في
              النص 70 وجيرانه أغمق؛ الناتج 190، يعني الفرق كبر والمركز بقى أفتح. مجموع
              الأوزان 5 − 1 − 1 − 1 − 1 = 1، عشان المناطق المسطحة تفضل زي ما هي؛ اللي بيتغير
              هو الفرق عند الحواف. لو الناتج خرج بره مدى 0 لـ255 بيتقص (clamp).
            </Text>
          </View>

          <View style={styles.arSection}>
            <Text style={styles.arHeading}>٥ · Σ يعني إيه؟</Text>
            <Text style={styles.arText}>
              Σ مجرد اختصار لكلمة «مجموع». مش خطوة زيادة. في المثال: 5×70 + (−1×30) +
              (−1×30) + (−1×50) + (−1×50) = 190. لو لقيت Σ في أي معادلة، اقرأها «اجمع اللي
              بعدها».
            </Text>
            <Text style={styles.arText}>
              ولو الأوزان كلها موجبة وبنقسم على مجموعها، بنبقى بنعمل متوسط (زي البلور).
              الشاربن بالأوزان السالبة بيزوّد التباين بدل ما ينعّم.
            </Text>
          </View>

          <View style={styles.arSection}>
            <Text style={styles.arHeading}>٦ · جرّب بنفسك</Text>
            <Text style={styles.arBullet}>• المركز 1 والباقي 0 -&gt; الصورة زي ما هي (Identity).</Text>
            <Text style={styles.arBullet}>
              • كل الخانات 1/9 -&gt; متوسط بسيط (box blur). أما Preset Blur فيستخدم Gaussian
              موزون.
            </Text>
            <Text style={styles.arBullet}>• المركز 5 والجيران المتعامدين −1 -&gt; حدة (Sharpen).</Text>
            <Text style={styles.arText}>
              آخر حاجة: عند حواف الصورة، المربع بيطلع بره؛ التطبيق بيختار بكسل بديل (Clamp /
              Reflect / Zero). الكروت في الشيت بتوضح الفرق، لكن الحسبة نفسها هي اللي
              شرحناها.
            </Text>
          </View>
        </ArabicGuide>

        {reduced ? null : (
          <MorphSlider
            label="Sweep speed"
            onCommit={setSpeed}
            value={speedShared}
            width={sliderWidth}
          />
        )}

        <MorphPressable
          accessibilityLabel="Edit the kernel weights and border mode"
          onPress={() => setKernelOpen(true)}
          restRadius={radius.md}
          pressedRadius={radius.lg}
          style={styles.kernelRow}
        >
          <View style={styles.kernelText}>
            <Text style={styles.kernelLabel}>KERNEL & BORDER</Text>
            <Text style={styles.kernelSummary}>
              {`${BORDER_LABELS[border]} border · 3×3 weights`}
            </Text>
          </View>
          <Text style={styles.kernelEdit}>Edit</Text>
        </MorphPressable>
      </ScrollView>

      <MorphSheet onClose={() => setKernelOpen(false)} title="Kernel & border" visible={kernelOpen}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          style={styles.sheetScroll}
        >
          <KernelEditor
            border={border}
            onBorderChange={setBorder}
            onWeightsChange={setWeights}
            weights={weights}
          />
        </ScrollView>
      </MorphSheet>

      <ExplainSheet
        onClose={() => setExplainVisible(false)}
        operation={convolveOp}
        visible={explainVisible}
      >
        <Text style={styles.caption}>
          Tip: zero every weight except the centre 1 — identity. Then move the 1 around: the output
          shifts instead of blurring.
        </Text>
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
  panels: { flexDirection: 'row', gap: space[2] },
  busyTag: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    backgroundColor: color.glassStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 3,
  },
  busyText: {
    fontFamily: font.caption,
    ...type.caption,
    fontSize: 10,
    color: color.accent.ink,
    letterSpacing: 0.6,
  },
  panel: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke,
  },
  panelLabel: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: space[1],
  },
  caption: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
  sumCard: { padding: space[3], gap: space[1] },
  sumLabel: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
  },
  sumLegend: {
    fontFamily: font.body,
    ...type.caption,
    color: color.text.secondary,
    marginBottom: space[1],
  },
  termRow: { fontFamily: font.mono, ...type.mono, color: color.text.secondary },
  sumValue: {
    fontFamily: font.mono,
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    color: color.accent.graphite,
    marginTop: space[1],
  },
  kernelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: color.bg[1],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
  },
  kernelText: { flex: 1, gap: space[1] },
  kernelLabel: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
  },
  kernelSummary: { fontFamily: font.headline, ...type.body, color: color.text.primary },
  kernelEdit: { fontFamily: font.caption, ...type.caption, color: color.text.primary },
  // Arabic copy uses the platform's Arabic face: no brand font carries Arabic
  // glyphs, so these styles intentionally omit `fontFamily`.
  arSection: { gap: space[1] },
  arHeading: {
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    fontWeight: '600',
    color: color.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  arText: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  arBullet: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  arStrong: { color: color.text.primary, fontWeight: '600' },
  arMatrices: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    marginTop: space[2],
  },
  arMatrixCol: { alignItems: 'center', gap: space[1] },
  arCaption: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.text.tertiary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  arTimes: {
    fontFamily: font.mono,
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    color: color.text.tertiary,
  },
  arFormulaBox: {
    marginTop: space[1],
    padding: space[2],
    borderRadius: radius.sm,
    backgroundColor: color.bg[2],
  },
  arFormula: {
    fontFamily: font.mono,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.text.primary,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingBottom: space[4] },
});
