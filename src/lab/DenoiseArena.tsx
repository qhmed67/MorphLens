/**
 * DenoiseArena — Lab screen 2, "Noise models & restoration" (PLAN §3.2 /
 * W2.13–W2.14). Inject gaussian / salt-and-pepper / speckle noise with a
 * fixed seed (so the amount slider scales one realisation instead of
 * re-rolling the dice), then run mean, gaussian, median and bilateral side by
 * side through the banded async executor (W2.10 policy). Live PSNR/SSIM
 * MorphNumber badges roll as results land; a spring-morphed crown marks the
 * PSNR winner; the optional difference heatmap shows where each filter still
 * fails (hot ramp). One Skia canvas hosts the four cards (layers, not
 * canvases — SKILL §1 rule 7), badges are a plain overlay.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, Crown, Info } from 'lucide-react-native';
import { duration, labMotion, spring } from '@/core/motion';
import { goBack } from '@/core/navigation';
import { color, font, radius, space, type } from '@/core/tokens';
import {
  computeMetrics,
  EngineCancelledError,
  getOperation,
  mergeParams,
  runOperation,
  type ImageBuffer,
  type Metrics,
} from '@/engine';
import { runOperationAsync } from '@/engine/exec';
import { imageBufferToSkImage } from '@/engine/bridge/skia';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSlider } from '@/morph/MorphSlider';
import { MorphSurface } from '@/morph/MorphSurface';
import { usePhotoStore } from '@/library/photoStore';
import { DenoiseArabicGuide } from './arabicGuides';
import { FILTERS, NOISE, NOISE_SEED, NOISE_TYPES, type NoiseType } from './denoiseFilters';
import { ExplainSheet } from './components/ExplainSheet';
import { Heatmap } from './components/Heatmap';
import { LabPill } from './components/LabPill';
import { MetricBadge } from './components/MetricBadge';
import { PhotoChooser } from './components/PhotoChooser';
import { createImagePool } from './imagePool';
import { useLabSource } from './useLabSource';

/**
 * The four cards are ~160 dp wide, so a 320 px proxy fills them on a modern
 * phone without upscaling mush. The earlier 192 px proxy made every result
 * look fuzzier than the original photo, which read as "the filters made it
 * worse"; bilateral filtering at 320 px still lands in ~25 ms.
 */
const ARENA_PROXY = 384;

/** Edge of the small "original" reference thumbnail. */
const REFERENCE_SIZE = 48;

/** Edge of each tile in the winner strip (clean photo → denoised result). */
const WINNER_TILE = 64;

/**
 * Release a SkImage after the canvas has had a frame to swap to its
 * replacement. Disposing inside a state updater can blank a card that is still
 * on screen (the same two-generation lesson as KernelTheatre).
 */
/** PSNR is Infinity for identical images — render it as the '∞' glyph. */
const formatPsnr = (value: number): string => (Number.isFinite(value) ? value.toFixed(1) : '∞');

/** SSIM with two decimals; hoisted so the badge's memo is not broken. */
const formatSsim = (value: number): string => value.toFixed(2);

export function DenoiseArena() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion() ?? false;
  const latestId = usePhotoStore((state) => state.order[0]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const activeId = chosenId ?? latestId ?? null;
  const source = useLabSource(ARENA_PROXY, activeId ?? undefined);

  const [noiseType, setNoiseType] = useState<NoiseType>('gaussian');
  const [amount, setAmount] = useState(0.3);
  const [heatOn, setHeatOn] = useState(false);
  const [busy, setBusy] = useState(false);
  // Frames fill in independently so the first filter is visible while the
  // slower bilateral pass is still running. The noisy input is the fallback
  // for every card, which means the grid is never blank.
  const [baseImage, setBaseImage] = useState<SkImage | null>(null);
  const [frames, setFrames] = useState<(SkImage | null)[]>(() => FILTERS.map(() => null));
  const [metrics, setMetrics] = useState<(Metrics | null)[]>(() => FILTERS.map(() => null));
  const [winner, setWinner] = useState(-1);
  const [winnerOut, setWinnerOut] = useState<ImageBuffer | null>(null);
  const [explainId, setExplainId] = useState<string | null>(null);

  const amountShared = useSharedValue(0.3); // slider position lives on the UI thread
  /** Owns the GPU image lifetimes (see `imagePool`). */
  const pool = useMemo(() => createImagePool(), []);
  const runSeq = useRef(0);
  const framesRef = useRef<(SkImage | null)[]>(FILTERS.map(() => null));
  const baseRef = useRef<SkImage | null>(null);

  // Free whatever generation is on screen at unmount. Replacement images are
  // retired by `disposeLater` once the canvas has moved on.
  useEffect(() => {
    return () => {
      pool.disposeAll();
      baseRef.current?.dispose();
      framesRef.current.forEach((image) => image?.dispose());
      baseRef.current = null;
      framesRef.current = FILTERS.map(() => null);
    };
  }, [pool]);

  // --- Pipeline -------------------------------------------------------------
  const runArena = useCallback(
    async (seq: number, buffer: ImageBuffer) => {
      const shouldCancel = () => seq !== runSeq.current;
      const noise = NOISE[noiseType];
      try {
        const noiseOp = getOperation(noise.id);
        const noiseParams = mergeParams(noiseOp.params, {
          ...noise.params(amount),
          seed: NOISE_SEED,
        });
        const noisy = runOperation(noise.id, buffer, noiseParams); // cheap global scan
        if (shouldCancel()) return;
        const noisyImage = imageBufferToSkImage(noisy);
        if (!noisyImage) throw new Error('Skia rejected the noisy preview');
        if (shouldCancel()) {
          noisyImage.dispose();
          return;
        }

        // New generation: show the noisy input immediately, then let each
        // filter replace its own card as it lands.
        const oldBase = baseRef.current;
        baseRef.current = noisyImage;
        setBaseImage(noisyImage);
        pool.retire(oldBase);

        const oldFrames = framesRef.current;
        const blankFrames = FILTERS.map<SkImage | null>(() => null);
        framesRef.current = blankFrames;
        setFrames(blankFrames);
        pool.retireAll(oldFrames);
        setMetrics(FILTERS.map<Metrics | null>(() => null));
        setWinner(-1);
        setWinnerOut(null);

        const outputs: (ImageBuffer | null)[] = FILTERS.map(() => null);
        const computed: (Metrics | null)[] = FILTERS.map(() => null);

        await Promise.all(
          FILTERS.map(async (filter, index) => {
            try {
              const operation = getOperation(filter.id);
              const params = mergeParams(operation.params, filter.params);
              const out = await runOperationAsync(filter.id, noisy, params, {
                shouldCancel,
              });
              if (shouldCancel()) return;
              outputs[index] = out;

              const skImage = imageBufferToSkImage(out);
              if (skImage) {
                if (shouldCancel()) {
                  skImage.dispose();
                  return;
                }
                const previous = framesRef.current[index];
                const next = [...framesRef.current];
                next[index] = skImage;
                framesRef.current = next;
                setFrames(next);
                pool.retire(previous);
              }

              const measured = computeMetrics(buffer, out);
              if (shouldCancel()) return;
              computed[index] = measured;
              setMetrics([...computed]);
            } catch (error: unknown) {
              // A newer noise type/amount superseded this run; the new run
              // owns the screen, so leave its state alone.
              if (!(error instanceof EngineCancelledError)) throw error;
            }
          }),
        );
        if (shouldCancel()) return;
        let best = -1;
        for (let i = 0; i < computed.length; i += 1) {
          const metric = computed[i];
          if (!metric) continue;
          if (best < 0 || metric.psnr > (computed[best]?.psnr ?? -Infinity)) best = i;
        }
        if (best >= 0 && outputs[best]) {
          setWinner(best);
          setWinnerOut(outputs[best]);
        }
      } catch (error: unknown) {
        if (seq === runSeq.current && !(error instanceof EngineCancelledError)) {
          Alert.alert('Denoise run failed', String(error));
        }
      } finally {
        if (seq === runSeq.current) setBusy(false);
      }
    },
    [noiseType, amount, pool],
  );

  // Debounced launch (PLAN §3.2: 150 ms after commit — the token). The busy
  // flag flips inside the timer callback, not the effect body. Cleanup also
  // invalidates any in-flight run so a new amount/type never queues behind
  // four stale filters.
  useEffect(() => {
    const buffer = source.buffer;
    if (!buffer) return;
    const seq = ++runSeq.current;
    const timer = setTimeout(() => {
      setBusy(true);
      void runArena(seq, buffer);
    }, labMotion.debounceMs);
    return () => {
      clearTimeout(timer);
      runSeq.current += 1;
    };
  }, [source.buffer, noiseType, amount, runArena]);

  // --- Winner crown ---------------------------------------------------------
  const cellW = (width - space[4] * 2 - space[2]) / 2;
  const imageH = cellW;
  // label (16) + gap (4) + PSNR/SSIM labels (16) + rolling numbers (24) +
  // top margin (4) + breathing room (8). A fixed block keeps the Canvas image
  // positions and the tappable rows on the same grid.
  const badgeBlock =
    type.caption.lineHeight * 2 + type.headline.lineHeight + space[1] * 2 + space[2];
  const rowStride = imageH + badgeBlock + space[2];
  // Include the second row's badges; the old height stopped after the images
  // and let row two's labels overlap the status line below the grid.
  const gridH = rowStride * 2 - space[2];

  const crownX = useSharedValue(-40);
  const crownY = useSharedValue(-40);
  const crownScale = useSharedValue(1);
  useEffect(() => {
    if (winner < 0) return;
    const targetX = (winner % 2) * (cellW + space[2]) + cellW / 2 - 10;
    const targetY = Math.floor(winner / 2) * rowStride + imageH / 2 - 10;
    if (reduced) {
      crownX.value = withTiming(targetX, { duration: duration.fast });
      crownY.value = withTiming(targetY, { duration: duration.fast });
      return;
    }
    crownX.value = withSpring(targetX, spring.smooth);
    crownY.value = withSpring(targetY, spring.smooth);
    crownScale.value = withSequence(
      withTiming(1.25, { duration: duration.fast }),
      withSpring(1, spring.gooey),
    );
  }, [winner, cellW, rowStride, imageH, reduced, crownX, crownY, crownScale]);
  const crownStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: crownX.value },
      { translateY: crownY.value },
      { scale: crownScale.value },
    ],
  }));

  // --- Winner error heatmap -------------------------------------------------
  // Rendering is delegated to <Heatmap>, which recomputes whenever
  // `winnerOut` changes (a new run); toggling only mounts/unmounts it.

  const sliderWidth = width - space[4] * 2;
  const gridW = width - space[4] * 2;

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
        <Text style={styles.title}>Denoise Arena</Text>
        <MorphPressable
          accessibilityLabel="Explain the noise model"
          onPress={() => setExplainId(NOISE[noiseType].id)}
          style={styles.headerButton}
        >
          <Info size={20} color={color.text.primary} />
        </MorphPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PhotoChooser caption={source.label} onSelect={setChosenId} selectedId={activeId} />

        <MorphSurface
          accessibilityLabel="Noise controls"
          borderRadius={radius.md}
          level={1}
          style={styles.controls}
        >
          <Text style={styles.sectionLabel}>Noise model</Text>
          <View style={styles.pills}>
            {NOISE_TYPES.map((id) => (
              <LabPill
                key={id}
                active={noiseType === id}
                label={NOISE[id].label}
                onPress={() => setNoiseType(id)}
              />
            ))}
          </View>
          <MorphSlider
            label="Noise amount"
            onCommit={setAmount}
            value={amountShared}
            width={sliderWidth - space[6]}
          />
        </MorphSurface>

        <View style={styles.referenceRow}>
          <View style={styles.referenceThumb}>
            <Canvas style={styles.referenceCanvas}>
              {source.image ? (
                <SkiaImage
                  fit="cover"
                  height={REFERENCE_SIZE}
                  image={source.image}
                  width={REFERENCE_SIZE}
                  x={0}
                  y={0}
                />
              ) : null}
            </Canvas>
          </View>
          <View style={styles.referenceText}>
            <Text style={styles.cardLabel}>Original</Text>
            <Text style={styles.caption}>the clean photo — the target</Text>
          </View>
          <View style={styles.flex} />
          <Text style={styles.caption}>
            {busy ? 'Working…' : 'noisy input → 4 filters'}
          </Text>
        </View>

        <View style={styles.gridHead}>
          <Text style={styles.sectionLabel}>Restoration · four filters</Text>
          <Text style={styles.caption}>tap a card to explain it</Text>
        </View>
        <Text style={styles.caption}>
          Crown = highest PSNR vs the clean photo (closeness, not sharpness).
        </Text>

        <View style={[styles.grid, { height: gridH }]}>
          <Canvas style={StyleSheet.absoluteFill}>
            {frames.map((image, index) => {
              // The clean source is visible from the first render; the noisy
              // input replaces it as soon as it is generated, and each card
              // swaps to its own filter result independently.
              const display = image ?? baseImage ?? source.image;
              return display ? (
                <SkiaImage
                  key={FILTERS[index].id}
                  fit="fill"
                  height={imageH}
                  image={display}
                  width={cellW}
                  x={(index % 2) * (cellW + space[2])}
                  y={Math.floor(index / 2) * rowStride}
                />
              ) : null;
            })}
          </Canvas>

          {[0, 1].map((row) => (
            <View
              key={row}
              style={[styles.gridRow, { top: row * rowStride, height: imageH + badgeBlock }]}
            >
              {[0, 1].map((col) => {
                const index = row * 2 + col;
                return (
                  <View key={FILTERS[index].id} style={{ width: cellW }}>
                    {/* A plain Pressable: the morph pressable dims what it
                        covers, which left a visible stain on the photo. */}
                    <Pressable
                      accessibilityLabel={`Explain the ${FILTERS[index].label} filter`}
                      accessibilityRole="button"
                      onPress={() => setExplainId(FILTERS[index].id)}
                      style={{ height: imageH }}
                    />
                    <View style={styles.badgeBlock}>
                      <Text style={styles.cardLabel}>{FILTERS[index].label}</Text>
                      <View style={styles.badgeRow}>
                        <MetricBadge
                          format={formatPsnr}
                          label="PSNR"
                          unit="decibels"
                          value={metrics[index]?.psnr ?? null}
                        />
                        <MetricBadge
                          format={formatSsim}
                          label="SSIM"
                          unit="structural similarity"
                          value={metrics[index]?.ssim ?? null}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          {winner >= 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.crown, crownStyle]}
              testID="arena-crown"
            >
              <Crown size={20} color={color.accent.ink} />
            </Animated.View>
          ) : null}
        </View>

        {winner >= 0 ? (
          <>
            <Text style={styles.caption}>
              {`Winner: ${FILTERS[winner].label} · crown marks the best PSNR`}
            </Text>
            {/* The proof, in one glance: the clean photo next to the winner. */}
            <View style={styles.winnerStrip}>
              <Canvas style={styles.winnerCanvas}>
                {source.image ? (
                  <SkiaImage
                    fit="cover"
                    height={WINNER_TILE}
                    image={source.image}
                    width={WINNER_TILE}
                    x={0}
                    y={0}
                  />
                ) : null}
                {frames[winner] ? (
                  <SkiaImage
                    fit="cover"
                    height={WINNER_TILE}
                    image={frames[winner] as SkImage}
                    width={WINNER_TILE}
                    x={WINNER_TILE + space[4]}
                    y={0}
                  />
                ) : null}
              </Canvas>
              <Text style={styles.caption}>clean photo → after denoise</Text>
            </View>
          </>
        ) : null}

        <DenoiseArabicGuide />

        <View style={styles.heatRow}>
          <LabPill
            active={heatOn}
            label="Difference heatmap"
            onPress={() => setHeatOn((on) => !on)}
          />
          {winner >= 0 ? (
            <LabPill
              active={false}
              label="Trace winner"
              onPress={() =>
                router.push({
                  pathname: '/explain/[op]',
                  params: {
                    op: FILTERS[winner].id,
                    ...(activeId ? { id: activeId } : {}),
                    ...Object.fromEntries(
                      Object.entries(FILTERS[winner].params).map(([key, value]) => [
                        key,
                        String(value),
                      ]),
                    ),
                  },
                })
              }
            />
          ) : null}
        </View>
        {heatOn && source.buffer ? (
          <Heatmap
            filtered={winnerOut}
            height={72}
            original={source.buffer}
            testID="arena-heatmap"
            width={gridW}
          />
        ) : null}
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
  controls: { padding: space[3], gap: space[2] },
  sectionLabel: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textTransform: 'uppercase',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  winnerStrip: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  winnerCanvas: { width: WINNER_TILE * 2 + space[4], height: WINNER_TILE },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  referenceThumb: {
    width: REFERENCE_SIZE,
    height: REFERENCE_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.bg[2],
  },
  referenceCanvas: { width: REFERENCE_SIZE, height: REFERENCE_SIZE },
  referenceText: { gap: 2 },
  flex: { flex: 1 },
  gridHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  grid: { position: 'relative', width: '100%' },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: space[2],
  },
  badgeBlock: { gap: space[1], marginTop: space[1] },
  cardLabel: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  badgeRow: { flexDirection: 'row', gap: space[6] },
  crown: { position: 'absolute', left: 0, top: 0 },
  caption: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
  arFilter: { gap: space[1] },
  heatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
