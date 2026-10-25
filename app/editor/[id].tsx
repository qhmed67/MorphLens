/**
 * Editor (Week 1): render the imported preview and run light engine operations.
 *
 * The pure-TS engine reads pixels through the Skia bridge, processes them, and
 * the result is re-uploaded to the canvas. Only discrete commits call React
 * state; the brightness slider lives on the UI thread until release.
 * Route: /editor/[id]. No dev build required.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Image as SkiaImage, useImage, type SkImage } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSurface } from '@/morph/MorphSurface';
import { MorphChip } from '@/morph/MorphChip';
import { MorphSlider } from '@/morph/MorphSlider';
import { MorphSkeleton } from '@/morph/MorphSkeleton';
import { LabPill } from '@/lab/components/LabPill';
import { usePhotoStore } from '@/library/photoStore';
import { imageBufferToSkImage, skImageToImageBuffer } from '@/engine/bridge/skia';
import { runOperationAsync } from '@/engine/exec';
import { color, font, radius, space, type } from '@/core/tokens';
import { goBack } from '@/core/navigation';

const OPS = ['Grayscale', 'Invert', 'Sepia', 'Posterize'] as const;
const OP_IDS: Record<(typeof OPS)[number], string> = {
  Grayscale: 'grayscale',
  Invert: 'invert',
  Sepia: 'sepia',
  Posterize: 'posterize',
};

/**
 * Operations with a staged "Trace" explanation. Each entry opens
 * `/explain/[op]` on THIS photo, with the settings the editor uses.
 */
const TRACES = [
  { op: 'unsharpMask', label: 'Sharpen', params: { amount: 1.2, radius: 1.4 } },
  { op: 'gaussianFilter', label: 'Denoise', params: { sigma: 1.4 } },
  { op: 'medianFilter', label: 'Median', params: { k: 3 } },
  { op: 'noiseGaussian', label: 'Noise', params: { sigma: 24, seed: 7 } },
  { op: 'sobelEdges', label: 'Edges', params: {} },
  { op: 'canny', label: 'Canny', params: {} },
  { op: 'equalize', label: 'Equalise', params: {} },
  { op: 'grayscale', label: 'Grayscale', params: {} },
  { op: 'invert', label: 'Invert', params: {} },
  { op: 'sepia', label: 'Sepia', params: {} },
  { op: 'posterize', label: 'Posterize', params: {} },
] as const;

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const photo = usePhotoStore((state) => (id ? state.photos[id] : undefined));
  const { width, height } = useWindowDimensions();
  const image = useImage(photo?.previewUri ?? null);
  const [rendered, setRendered] = useState<SkImage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const brightness = useSharedValue(0.5);

  // Dispose the previous derived image when it is replaced or the screen unmounts.
  useEffect(() => {
    return () => {
      rendered?.dispose();
    };
  }, [rendered]);

  // The preview pixels are read back **once** per photo. Reading them on
  // every chip press meant a ~4 MB GPU→CPU copy per interaction, which is
  // what made the editor feel laggy.
  const sourceBuffer = useMemo(() => (image ? skImageToImageBuffer(image) : null), [image]);

  // Every edit runs through the async executor: it yields a frame before the
  // work starts, so the "working" badge is actually on screen while the
  // engine is busy. The app must never look frozen (owner, 2026-10-21).
  const run = useCallback(
    async (opId: string | null, params: Record<string, number> = {}) => {
      if (!opId) {
        setRendered(null);
        setSelected(null);
        return;
      }
      if (!sourceBuffer) return;
      setBusy(true);
      try {
        const output = await runOperationAsync(opId, sourceBuffer, params);
        const next = imageBufferToSkImage(output);
        if (!next) throw new Error('Skia rejected the processed image.');
        setRendered(next);
        setSelected(opId);
      } catch (error) {
        Alert.alert('Operation failed', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setBusy(false);
      }
    },
    [sourceBuffer],
  );

  const canvasWidth = width - space[4] * 2;
  const ratio = photo ? photo.height / photo.width : 1;
  const canvasHeight = Math.max(200, Math.min(height * 0.42, canvasWidth * ratio));

  if (!photo) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.title}>Photo not found</Text>
          <Text style={styles.subtitle}>This session no longer holds that import.</Text>
          <MorphPressable
            accessibilityLabel="Go back home"
            onPress={() => goBack(router)}
            style={styles.primarySmall}
            restRadius={radius.pill}
            pressedRadius={radius.pill}
          >
            <Text style={styles.primarySmallLabel}>Back</Text>
          </MorphPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <MorphPressable
            accessibilityLabel="Go back"
            onPress={() => goBack(router)}
            style={styles.iconButton}
            restRadius={radius.pill}
            pressedRadius={radius.pill}
          >
            <ArrowLeft size={20} color={color.text.primary} strokeWidth={1.75} />
          </MorphPressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Editor</Text>
            <Text style={styles.subtitle}>
              {photo.width}×{photo.height} · engine proxy 1080 px
            </Text>
          </View>
          <MorphPressable
            accessibilityLabel="Reset to original"
            onPress={() => run(null)}
            style={styles.iconButton}
            restRadius={radius.pill}
            pressedRadius={radius.pill}
          >
            <RotateCcw size={18} color={color.text.primary} strokeWidth={1.75} />
          </MorphPressable>
        </View>

        <View style={[styles.canvasWrap, { width: canvasWidth, height: canvasHeight }]}>
          {image ? (
            <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
              <SkiaImage
                image={rendered ?? image}
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fit="contain"
              />
            </Canvas>
          ) : (
            <MorphSkeleton width={canvasWidth} height={canvasHeight} borderRadius={radius.lg} />
          )}
          {busy ? (
            <View pointerEvents="none" style={styles.busyTag}>
              <Text style={styles.busyText}>WORKING…</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Adjustments · pure TypeScript</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <MorphChip label="Original" active={selected === null} onPress={() => run(null)} />
          {OPS.map((label) => (
            <MorphChip
              key={label}
              label={label}
              active={selected === OP_IDS[label]}
              onPress={() => run(OP_IDS[label])}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>See the maths · on this photo</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {TRACES.map((trace) => (
            <LabPill
              key={trace.op}
              active={false}
              label={trace.label}
              onPress={() =>
                router.push({
                  pathname: '/explain/[op]',
                  params: {
                    op: trace.op,
                    id: photo.id,
                    ...Object.fromEntries(
                      Object.entries(trace.params).map(([key, value]) => [key, String(value)]),
                    ),
                  },
                })
              }
            />
          ))}
        </ScrollView>

        <MorphSurface level={2} style={styles.sliderCard} borderRadius={radius.lg}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Brightness</Text>
            <Text style={styles.mono}>−100 … +100</Text>
          </View>
          <MorphSlider
            value={brightness}
            width={canvasWidth - space[4] * 2}
            label="Brightness"
            onCommit={(value) => run('brightness', { amount: Math.round((value - 0.5) * 200) })}
          />
        </MorphSurface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg[0] },
  content: { paddingHorizontal: space[4], paddingBottom: space[10] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
  },
  title: { color: color.text.primary, fontFamily: font.title, ...type.title },
  subtitle: { color: color.text.secondary, fontFamily: font.body, ...type.caption },
  busyTag: {
    position: 'absolute',
    top: space[3],
    right: space[3],
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
  canvasWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.bg[1],
    marginTop: space[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: color.text.secondary,
    fontFamily: font.caption,
    ...type.caption,
    textTransform: 'uppercase',
    marginTop: space[5],
    marginBottom: space[3],
  },
  chips: { gap: space[2], paddingRight: space[4] },
  sliderCard: { marginTop: space[4], padding: space[4], gap: space[2] },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { color: color.text.primary, fontFamily: font.headline, ...type.headline },
  mono: { color: color.text.secondary, fontFamily: font.mono, ...type.mono },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    padding: space[6],
  },
  primarySmall: {
    marginTop: space[3],
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    backgroundColor: color.accent.ink,
  },
  primarySmallLabel: { color: color.text.onAccent, fontFamily: font.headline, ...type.headline },
});
