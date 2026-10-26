/**
 * StageTheatre — "Trace": the maths of one operation, performed on *this*
 * photo, with the user in control (owner revision 2026-10-20).
 *
 * Stages come from `stages.ts` (real engine outputs, never a canned example),
 * so the last frame is exactly what the operation does to this image and the
 * middle frames are the actual low-pass / detail / gradient maps it uses.
 * Playback is a continuous crossfade driven by one shared value (SKILL §1
 * rule 1: no React state in the frame loop); this screen owns the playhead and
 * the photo selection, while React only learns discrete stage crossings.
 *
 * Owner feedback folded in:
 *  - the photo is chosen *inside* the theatre (PhotoChooser), not inherited
 *    silently from the editor;
 *  - the playhead is manual by default, with Original/Result jumps for a
 *    guaranteed look at the result; autoplay is opt-in;
 *  - the operation's primary parameter is adjustable and a commit rebuilds
 *    every stage, then parks on the result so the change is visible;
 *  - the bottom widget explains the maths in motion (probe plot + live values)
 *    and types the engine code that performs it;
 *  - the layout is short enough to keep image, explainer and maths on one
 *    screen on a phone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  Rect,
  type SkImage,
} from '@shopify/react-native-skia';
import Animated, {
  FadeIn,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ArrowLeft, Pause, Play } from 'lucide-react-native';
import { duration, ease, labMotion } from '@/core/motion';
import { goBack } from '@/core/navigation';
import { color, font, radius, space, type } from '@/core/tokens';
import { MorphPressable } from '@/morph/MorphPressable';
import { MorphSkeleton } from '@/morph/MorphSkeleton';
import { MorphSlider } from '@/morph/MorphSlider';
import { getOperation, mergeParams, type ImageBuffer } from '@/engine';
import { imageBufferToSkImage } from '@/engine/bridge/skia';
import { MathPanel } from './MathPanel';
import { createImagePool } from './imagePool';
import { PhaseScrubber } from './PhaseScrubber';
import { PhotoChooser } from './components/PhotoChooser';
import { TRACE_CONTROLS, buildStages, traceControlValue, type StageSet } from './stages';

type Props = {
  source: ImageBuffer;
  opId: string;
  /** User/route params; merged with registry defaults for the stage build. */
  params?: Record<string, number>;
  /** Provenance caption inside the chooser, e.g. 'Photo · 512×512 proxy'. */
  sourceLabel?: string;
  /** The photo currently on screen (null = synthetic fallback). */
  selectedPhotoId: string | null;
  onPhotoSelect: (id: string) => void;
};

/** One crossfading Skia layer; opacity derives from the shared stage position. */
function StageLayer({
  image,
  index,
  pos,
  width,
  height,
}: {
  image: SkImage;
  index: number;
  pos: SharedValue<number>;
  width: number;
  height: number;
}) {
  const opacity = useDerivedValue(() => Math.max(0, 1 - Math.abs(pos.value - index)));
  return (
    <SkiaImage
      fit="contain"
      height={height}
      image={image}
      opacity={opacity}
      width={width}
      x={0}
      y={0}
    />
  );
}

function display(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function StageTheatre({
  source,
  opId,
  params = {},
  sourceLabel,
  selectedPhotoId,
  onPhotoSelect,
}: Props) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion() ?? false;
  const compact = height < 760;

  // Unknown ids are possible from a stale deep link; `getOperation` throws by
  // design, so contain it here and show the graceful empty state below.
  const operation = useMemo(() => {
    try {
      return getOperation(opId);
    } catch {
      return null;
    }
  }, [opId]);

  const control = TRACE_CONTROLS[opId];
  const routeMerged = operation ? mergeParams(operation.params, params) : {};
  const [controlValue, setControlValue] = useState<number | null>(() =>
    control ? (routeMerged[control.key] ?? control.min) : null,
  );

  const effectiveParams = useMemo(
    () => (control && controlValue !== null ? { ...params, [control.key]: controlValue } : params),
    [control, controlValue, params],
  );
  const merged = useMemo(
    () => (operation ? mergeParams(operation.params, effectiveParams) : {}),
    [operation, effectiveParams],
  );

  const [stageSet, setStageSet] = useState<StageSet | null>(null);
  const [layers, setLayers] = useState<SkImage[]>([]);
  const [building, setBuilding] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const stagePos = useSharedValue(0);
  const controlPos = useSharedValue(
    control && controlValue !== null
      ? (controlValue - control.min) / Math.max(1e-6, control.max - control.min)
      : 0,
  );
  /** True while the finger owns the playhead, so the snap effect stands down. */
  const scrubbing = useRef(false);
  /** A parameter commit parks on the result once the new stages are built. */
  const jumpToResult = useRef(false);

  const paramsKey = JSON.stringify(effectiveParams);
  /** The generation of stage images currently on screen. */
  const layersRef = useRef<SkImage[]>([]);
  /** Owns the GPU image lifetimes (see `imagePool`). */
  const pool = useMemo(() => createImagePool(), []);

  // Build stages off the commit path: heavy ops (Canny, unsharp) take a few
  // frames on device, and the screen shows a skeleton while they run. photo
  // or op changes start at the original; parameter commits land on the result.
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setBuilding(true);
      // Wait one frame so the skeleton (and the COMPUTING badge) is on screen
      // before the stage build blocks the JS thread.
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const built = operation ? buildStages(opId, source, effectiveParams) : null;
      if (cancelled) return;
        const target = built ? (jumpToResult.current ? built.stages.length - 1 : 0) : 0;
        jumpToResult.current = false;
        setStageSet(built);
        setIndex(target);
        stagePos.set(target);
        const next = built
          ? built.stages
              .map((stage) => imageBufferToSkImage(stage.image))
              .filter((image): image is SkImage => image !== null)
          : [];
        // Retire the previous generation *after* the canvas has swapped to the
        // new one: disposing it inside the state updater blanked the photo.
        const previous = layersRef.current;
        layersRef.current = next;
        setLayers(next);
        pool.retireAll(previous);
        setBuilding(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
    // paramsKey captures real param/control changes; `effectiveParams` churns
    // identity every render and would rebuild forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, opId, paramsKey, stagePos, operation]);

  // Release every image this screen still owns when it unmounts. The pool
  // also keeps the retired generations alive long enough for the GPU to let
  // go of them, so the canvas never draws a disposed image.
  useEffect(() => {
    return () => {
      pool.disposeAll();
      layersRef.current.forEach((image) => image.dispose());
      layersRef.current = [];
    };
  }, [pool]);

  const count = stageSet?.stages.length ?? 0;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setPlaying(false);
      const target = ((next % count) + count) % count;
      setIndex(target);
      // Animate here as well as in the effect: when the user taps the stage
      // they are already parked on, the index does not change but the morphed
      // position still needs to settle back onto that exact stage.
      stagePos.set(
        withTiming(target, {
          duration: reduced ? duration.fast : duration.morph,
          easing: ease.emphasized,
        }),
      );
    },
    [count, reduced, stagePos],
  );

  // The snap effect is the only writer of the playhead outside a drag. While
  // scrubbing, the gesture owns `stagePos`; otherwise a stage change animates
  // through the same crossfade used by autoplay.
  useEffect(() => {
    if (scrubbing.current) return;
    stagePos.set(
      withTiming(index, {
        duration: reduced ? duration.fast : duration.morph,
        easing: ease.emphasized,
      }),
    );
  }, [index, reduced, stagePos]);

  // Opt-in autoplay: one discrete timer per stage hold. A last→first wrap
  // sweeps the crossfade through every layer, reading as a rewind.
  useEffect(() => {
    if (!playing || !stageSet || reduced || stageSet.stages.length < 2) return;
    const timer = setTimeout(() => {
      setIndex((current) => (current + 1) % stageSet.stages.length);
    }, labMotion.stageHold);
    return () => clearTimeout(timer);
  }, [playing, stageSet, index, reduced]);

  const startScrub = useCallback(() => {
    scrubbing.current = true;
    setPlaying(false);
  }, []);

  const endScrub = useCallback(() => {
    scrubbing.current = false;
  }, []);

  const commitControl = useCallback(
    (normalised: number) => {
      if (!control || controlValue === null) return;
      const next = traceControlValue(control, normalised);
      if (next !== controlValue) {
        jumpToResult.current = true;
        setControlValue(next);
      }
      controlPos.set((next - control.min) / Math.max(1e-6, control.max - control.min));
    },
    [control, controlValue, controlPos],
  );

  const imageW = width - space[4] * 2;
  const ratio = source.height / source.width;
  const imageH = Math.max(140, Math.min(height * (compact ? 0.26 : 0.3), imageW * ratio));

  // Map the probe's image coordinates into the letterboxed `contain` rect.
  const drawScale = Math.min(imageW / source.width, imageH / source.height);
  const drawW = source.width * drawScale;
  const drawH = source.height * drawScale;
  const probeX = (imageW - drawW) / 2 + (stageSet?.probe.x ?? 0) * drawScale;
  const probeY = (imageH - drawH) / 2 + (stageSet?.probe.y ?? 0) * drawScale;

  const current = stageSet?.stages[index] ?? null;
  // One fixed height for the maths panel (and its skeleton) so the screen
  // does not resize when the stages finish building.
  const panelHeight = compact ? 210 : 264;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <MorphPressable
          accessibilityLabel="Back"
          onPress={() => goBack(router)}
          style={styles.iconButton}
        >
          <ArrowLeft size={20} color={color.text.primary} strokeWidth={1.75} />
        </MorphPressable>
        <Text numberOfLines={1} style={styles.title}>
          {stageSet?.title ?? operation?.name ?? 'Trace'}
        </Text>
        <MorphPressable
          accessibilityLabel={playing ? 'Pause the phase sequence' : 'Play the phase sequence'}
          disabled={reduced || count < 2}
          onPress={() => setPlaying((value) => !value)}
          style={[styles.iconButton, (reduced || count < 2) && styles.iconDisabled]}
        >
          {playing ? (
            <Pause size={18} color={color.text.primary} strokeWidth={1.75} />
          ) : (
            <Play size={18} color={color.text.primary} strokeWidth={1.75} />
          )}
        </MorphPressable>
      </View>

      {/* A scroll view keeps a long Trace reachable, and the fixed panel
          height below means the layout never jumps when the stages arrive. */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
      <View style={styles.chooserRow}>
        <PhotoChooser
          caption={sourceLabel}
          onSelect={onPhotoSelect}
          selectedId={selectedPhotoId}
        />
      </View>

      <View style={[styles.canvasWrap, { width: imageW, height: imageH }]}>
        {building ? (
          <MorphSkeleton width={imageW} height={imageH} borderRadius={radius.md} />
        ) : layers.length > 0 ? (
          <Canvas style={{ width: imageW, height: imageH }}>
            {/* Ink base: the photo window is the one dark surface in a light
              UI, so white edge maps (and sparse NMS layers) stay legible. */}
            <Rect color={color.accent.ink} height={imageH} width={imageW} x={0} y={0} />
            {layers.map((image, layerIndex) => (
              <StageLayer
                key={stageSet?.stages[layerIndex]?.key ?? layerIndex}
                height={imageH}
                image={image}
                index={layerIndex}
                pos={stagePos}
                width={imageW}
              />
            ))}
            {stageSet ? (
              <Group>
                <Circle
                  color={color.photoStrokeStrong}
                  cx={probeX}
                  cy={probeY}
                  r={6}
                  strokeWidth={1.5}
                  style="stroke"
                />
                <Rect
                  color={color.photoStrokeStrong}
                  height={1}
                  width={18}
                  x={probeX - 9}
                  y={probeY}
                />
                <Rect
                  color={color.photoStrokeStrong}
                  height={18}
                  width={1}
                  x={probeX}
                  y={probeY - 9}
                />
              </Group>
            ) : null}
          </Canvas>
        ) : (
          <Text style={styles.empty}>No staged explanation for this operation yet.</Text>
        )}
        {building ? (
          <View pointerEvents="none" style={styles.busyTag}>
            <Text style={styles.busyText}>COMPUTING…</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.stageBlock, compact && styles.stageBlockCompact]}>
        {current ? (
          <>
            <View style={styles.stageTitleRow}>
              <Text style={styles.counter}>
                {count > 0
                  ? `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
                  : '— / —'}
              </Text>
              <Animated.Text
                key={`title-${current.key}`}
                entering={reduced ? undefined : FadeIn.duration(duration.base)}
                numberOfLines={1}
                style={styles.stageTitle}
              >
                {current.title}
              </Animated.Text>
              <View style={styles.flex} />
              <MorphPressable
                accessibilityLabel="Show the original photo"
                onPress={() => goTo(0)}
                restRadius={radius.pill}
                pressedRadius={radius.pill}
                style={styles.jump}
              >
                <Text style={[styles.jumpText, index === 0 && styles.jumpTextActive]}>
                  Original
                </Text>
              </MorphPressable>
              <MorphPressable
                accessibilityLabel="Show the operation result"
                onPress={() => goTo(count - 1)}
                restRadius={radius.pill}
                pressedRadius={radius.pill}
                style={styles.jump}
              >
                <Text style={[styles.jumpText, index === count - 1 && styles.jumpTextActive]}>
                  Result
                </Text>
              </MorphPressable>
            </View>
            <Animated.Text
              key={`note-${current.key}`}
              entering={reduced ? undefined : FadeIn.duration(duration.base)}
              numberOfLines={compact ? 1 : 2}
              style={styles.stageNote}
            >
              {current.note}
            </Animated.Text>
          </>
        ) : (
          <View style={styles.stagePlaceholder} />
        )}
      </View>

      {count > 1 ? (
        <PhaseScrubber
          count={count}
          index={index}
          onScrub={setIndex}
          onScrubEnd={endScrub}
          onScrubStart={startScrub}
          onStep={(delta) => goTo(index + delta)}
          position={stagePos}
        />
      ) : (
        <View style={styles.scrubberSpacer} />
      )}

      {control && controlValue !== null ? (
        <View style={styles.control}>
          <View style={styles.controlHead}>
            <Text style={styles.controlLabel}>{control.label}</Text>
            <Text style={styles.controlValue}>{display(controlValue)}</Text>
          </View>
          <MorphSlider
            label={control.label}
            onCommit={commitControl}
            value={controlPos}
            width={imageW}
          />
        </View>
      ) : null}

      {stageSet ? (
        <MathPanel
          compact={compact}
          height={panelHeight}
          index={index}
          onSeek={goTo}
          params={merged}
          position={stagePos}
          reduced={reduced}
          stageSet={stageSet}
        />
      ) : building ? (
        <MorphSkeleton borderRadius={radius.lg} height={panelHeight} width={imageW} />
      ) : (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyPanelText}>No maths panel for this operation.</Text>
        </View>
      )}

      {building || reduced || compact ? null : (
        <Text style={styles.hint}>
          {`Drag the playhead to morph · ${
            control ? 'release the slider to recompute' : 'tap Maths or Code for the maths'
          }`}
        </Text>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg[0],
    paddingHorizontal: space[4],
    paddingBottom: space[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
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
  scroll: { flex: 1 },
  content: { paddingBottom: space[6], gap: space[2] },
  chooserRow: { alignItems: 'flex-start', paddingBottom: space[1] },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg[1],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke,
  },
  iconDisabled: { opacity: 0.45 },
  title: {
    flex: 1,
    fontFamily: font.title,
    ...type.title,
    color: color.text.primary,
  },
  canvasWrap: {
    alignSelf: 'center',
    marginTop: space[1],
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.accent.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke,
  },
  empty: {
    padding: space[4],
    fontFamily: font.body,
    ...type.body,
    color: color.text.onAccent,
    textAlign: 'center',
  },
  stageBlock: {
    marginTop: space[2],
    minHeight: type.headline.lineHeight + type.body.lineHeight * 2 + space[1],
  },
  stageBlockCompact: { minHeight: type.headline.lineHeight + type.body.lineHeight + space[1] },
  stageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  counter: { fontFamily: font.mono, ...type.mono, color: color.text.tertiary },
  stageTitle: {
    flexShrink: 1,
    fontFamily: font.headline,
    ...type.headline,
    color: color.text.primary,
  },
  jump: { paddingHorizontal: space[2], paddingVertical: space[1] },
  jumpText: { fontFamily: font.caption, ...type.caption, color: color.text.tertiary },
  jumpTextActive: { color: color.text.primary },
  stageNote: {
    fontFamily: font.body,
    ...type.body,
    color: color.text.secondary,
    marginTop: space[1],
  },
  stagePlaceholder: { height: 1 },
  scrubberSpacer: { height: 8 },
  control: { marginTop: space[1] },
  controlHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlLabel: { fontFamily: font.caption, ...type.caption, color: color.text.secondary },
  controlValue: { fontFamily: font.mono, ...type.mono, color: color.text.primary },
  flex: { flex: 1 },
  emptyPanel: {
    flex: 1,
    minHeight: 176,
    marginTop: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.bg[1],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.strokeStrong,
  },
  emptyPanelText: { fontFamily: font.body, ...type.body, color: color.text.tertiary },
  hint: {
    fontFamily: font.caption,
    ...type.caption,
    color: color.text.tertiary,
    textAlign: 'center',
    marginTop: space[1],
  },
});
