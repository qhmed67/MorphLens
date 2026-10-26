---
name: morph-rn
description: Build modern, fluid "Morph UI" React Native (Expo) components, screens, animations, Skia shader filters and visualizations for the MorphLens photo-filter app using only free libraries (Reanimated, Gesture Handler, Skia). Use whenever creating or modifying any UI component, screen, transition, gesture, shader, or data visualization in this project.
---

# Morph RN Skill

You are building UI for **MorphLens**: an app where users upload a photo and apply filters that visibly *flow* across the image, with rich visualizations. The visual language is **Morph UI** — surfaces transform into each other, shapes are liquid, motion is physical. Everything must be **free** (MIT/Apache libraries, free fonts, no paid services).

Place this file at `.claude/skills/morph-rn/SKILL.md` (Claude Code) or reference it from `AGENTS.md` / `.cursor/rules` so the agent loads it on every UI task.

---

## 0. Before you write anything

1. Read `design.md` → tokens (`src/core/tokens.ts`), motion presets (`src/core/motion.ts`), primitives list, visualization language.
2. Read `architecture.md` → folder structure, filter contract, data flow.
3. **Never invent** colors, radii, springs, or durations. If one is missing, add it to the token/motion file first, then use it.
4. If an API is uncertain, **check the docs for the installed version** instead of guessing:
   - Reanimated / Worklets: https://docs.swmansion.com/react-native-reanimated/
   - Skia: https://shopify.github.io/react-native-skia/
   - Expo SDK: https://docs.expo.dev/versions/latest/
   - Gesture Handler: https://docs.swmansion.com/react-native-gesture-handler/

---

## 1. Hard rules

| # | Rule |
|---|---|
| 1 | **Stack:** Expo (latest stable SDK) · TypeScript `strict` · expo-router · Reanimated 4 + `react-native-worklets` · Gesture Handler · `@shopify/react-native-skia` · zustand. Install through `npx expo install` so versions match the SDK. |
| 2 | **Free only.** No paid SDKs/APIs/fonts/assets. Shader code must be written by us or MIT/CC0 (Shadertoy defaults to CC BY-NC-SA — do **not** copy from it). |
| 3 | **Expo Go compatible** by default (Skia, Reanimated, Gesture Handler, expo-blur, expo-haptics are all fine). If a feature needs a dev build, say so in a comment at the top of the file. |
| 4 | **Animation values live in shared values, never React state.** No `setState` per frame, per gesture event, or per slider tick. |
| 5 | Use `react-native-reanimated`, never `Animated` from `react-native`; never `useNativeDriver`. |
| 6 | Gestures use the **Gesture API** (`Gesture.Pan()` + `GestureDetector`). `useAnimatedGestureHandler` does not exist in v4. |
| 7 | Pixel-level effects, goo, path morphs, particles, glow, shaders → **Skia**. Layout/transform/opacity/color/radius → **Reanimated styles**. |
| 8 | Import values from `@/core/tokens` and `@/core/motion`. No literals for color/radius/spacing/spring. |
| 9 | Thread bridging goes through `@/core/threads` (a single file re-exporting `runOnJS`/`runOnUI`) so we can adapt in one place if the Worklets API renames them. |
| 10 | Every component: typed props, `accessibilityRole` + label, `testID`, ≥ 44 pt hit target, reduced-motion variant. |
| 11 | Named exports, one component per file, file name = component name, `memo` for list items and canvas children. |
| 12 | Compile `RuntimeEffect`s **once at module scope**, null-check, and provide a fallback. |

---

## 2. Which tool for which job

| Need | Use |
|---|---|
| Press feedback, toggles, scale/opacity/color/radius | `useSharedValue` + `useAnimatedStyle` + `withSpring` |
| Mount / unmount / reorder | Reanimated layout animations: `entering`, `exiting`, `layout` (`FadeIn`, `LinearTransition`, …) |
| Finger-driven motion | Gesture Handler → shared values → `withSpring(…, { velocity })` / `withDecay` |
| Button/card becomes panel/screen | **Container transform** (§5.2): `measureInWindow` + animated rect |
| Gooey blobs, loaders, liquid indicator | Skia `Group layer` + `Blur` + `ColorMatrix` (§5.3) |
| Icon → icon | Skia `interpolatePath` (§5.4) |
| Image filters, transitions, distortions | Skia `RuntimeEffect` / `Shader` (§5.5, §6) |
| Particles, rings, scan bars, glows | Skia primitives driven by `useDerivedValue` |
| Frosted panels | `expo-blur` (≤ 2 per screen) with an opaque fallback |
| Continuous clock for animated shaders | `useFrameCallback` writing to a shared value |

Do **not** rely on Reanimated's `sharedTransitionTag` (experimental). Use §5.2.

---

## 3. Component workflow (follow in order)

1. **Name the morph.** What is the origin shape and the destination shape? If something appears/disappears, define where it comes from/goes to.
2. **Pick the owner of each animated value** (shared value in the component, or passed in from the parent as a `SharedValue`). Prefer *accepting* a `SharedValue` over `value + onChange` when the value drives visuals.
3. **List states:** idle · pressed · focused · disabled · loading · error · reduced-motion.
4. **Choose presets** from `motion.ts` (spring for touch/shape, timing for color/opacity/shader progress).
5. **Write the component** from the template in §4.
6. **Add a11y**: role, label, state, hitSlop.
7. **Perf pass** (§7).
8. **Definition of Done** (§10).

---

## 4. Standard component template

```tsx
// src/morph/MorphSwitch.tsx
import { memo, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
  interpolateColor, useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { color, radius } from '@/core/tokens';
import { spring } from '@/core/motion';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
};

const W = 52, H = 30, PAD = 3, THUMB = 24;

export const MorphSwitch = memo(function MorphSwitch({
  value, onValueChange, disabled, accessibilityLabel, testID,
}: Props) {
  const reduced = useReducedMotion();
  const p = useSharedValue(value ? 1 : 0);      // 0 off → 1 on
  const stretch = useSharedValue(0);            // liquid stretch while moving

  useEffect(() => {
    if (reduced) { p.value = withTiming(value ? 1 : 0, { duration: 150 }); return; }
    stretch.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, spring.gooey));
    p.value = withSpring(value ? 1 : 0, spring.snappy);
  }, [value, reduced]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [color.glassStrong, color.accent.violet]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: PAD + p.value * (W - THUMB - PAD * 2) },
      { scaleX: 1 + stretch.value * 0.35 },
    ],
  }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={12}
      disabled={disabled}
      onPress={() => { Haptics.selectionAsync(); onValueChange(!value); }}
    >
      <Animated.View style={[{ width: W, height: H, borderRadius: radius.pill, justifyContent: 'center', opacity: disabled ? 0.4 : 1 }, track]}>
        <Animated.View style={[{ width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: color.text.primary }, thumb]} />
      </Animated.View>
    </Pressable>
  );
});
```

---

## 5. Recipes

### 5.1 `MorphPressable` — the base of every button/card

```tsx
// src/morph/MorphPressable.tsx
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { spring } from '@/core/motion';
import { radius } from '@/core/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  restRadius?: number;
  pressedRadius?: number;
};

export function MorphPressable({
  style, haptic = true, restRadius = radius.lg, pressedRadius = radius.xl,
  onPressIn, onPressOut, ...rest
}: Props) {
  const p = useSharedValue(0); // 0 rest → 1 pressed
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.96]) }],
    borderRadius: interpolate(p.value, [0, 1], [restRadius, pressedRadius]),
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={(e) => {
        p.value = withSpring(1, spring.snappy);
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => { p.value = withSpring(0, spring.gooey); onPressOut?.(e); }}
      style={[style, anim]}
      {...rest}
    />
  );
}
```

### 5.2 Container transform (button/card → panel/screen, and back into the same rect)

Render the overlay in a **root-level absolute container** so `measureInWindow` coordinates match.

```tsx
// src/morph/useContainerTransform.ts
import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import {
  useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { runOnJS } from '@/core/threads';
import { spring } from '@/core/motion';

export type Rect = { x: number; y: number; width: number; height: number; r: number };

export function useContainerTransform(target: Rect, fromRadius = 20) {
  const triggerRef = useRef<View>(null);
  const [mounted, setMounted] = useState(false);
  const p = useSharedValue(0);                                   // 0 = trigger rect, 1 = target rect
  const from = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0, r: fromRadius });

  const open = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      from.value = { x, y, width, height, r: fromRadius };
      setMounted(true);
      p.value = withSpring(1, spring.smooth);
    });
  }, [fromRadius]);

  const close = useCallback(() => {
    p.value = withSpring(0, spring.smooth, (done) => { if (done) runOnJS(setMounted)(false); });
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: interpolate(p.value, [0, 1], [from.value.x, target.x]),
    top: interpolate(p.value, [0, 1], [from.value.y, target.y]),
    width: interpolate(p.value, [0, 1], [from.value.width, target.width]),
    height: interpolate(p.value, [0, 1], [from.value.height, target.height]),
    borderRadius: interpolate(p.value, [0, 1], [from.value.r, target.r]),
    overflow: 'hidden',
  }));
  // crossfade rule: A out in first 35 %, B in from 45 %
  const triggerContentStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.35], [1, 0], Extrapolation.CLAMP) }));
  const targetContentStyle  = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.45, 1], [0, 1], Extrapolation.CLAMP) }));
  const scrimStyle          = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0, 0.6], Extrapolation.CLAMP) }));

  return { triggerRef, mounted, open, close, progress: p, panelStyle, triggerContentStyle, targetContentStyle, scrimStyle };
}
```

Hide the real trigger (`opacity: mounted ? 0 : 1`) while the overlay is open so there is only one visible copy.

### 5.3 Gooey blobs (Skia)

```tsx
// src/morph/GooBlobs.tsx
import { useMemo } from 'react';
import { Canvas, Circle, Group, Paint, Blur, ColorMatrix } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

type P = { x: number; y: number };
type Props = { width: number; height: number; a: SharedValue<P>; b: SharedValue<P>; colorA: string; colorB: string };

// Standard goo: blur, then push alpha toward 0/1 (the last row: x20 - 9)
const GOO = [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,20,-9];

export function GooBlobs({ width, height, a, b, colorA, colorB }: Props) {
  const layer = useMemo(() => (
    <Paint><Blur blur={14} /><ColorMatrix matrix={GOO} /></Paint>
  ), []);
  const ax = useDerivedValue(() => a.value.x), ay = useDerivedValue(() => a.value.y);
  const bx = useDerivedValue(() => b.value.x), by = useDerivedValue(() => b.value.y);
  return (
    <Canvas style={{ width, height }}>
      <Group layer={layer}>
        <Circle cx={ax} cy={ay} r={28} color={colorA} />
        <Circle cx={bx} cy={by} r={22} color={colorB} />
      </Group>
    </Canvas>
  );
}
```
Drive `a`/`b` with `withSpring(…, spring.gooey)` toward the finger or a target; the closer they get, the more they merge.

### 5.4 Icon morph (path interpolation)

Both paths must have the **same verb sequence** (use explicit `M`/`L`/`C`, no `H`/`V`/arcs).

```tsx
// src/morph/MorphIcon.tsx
import { Canvas, Path, Skia, interpolatePath } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

const PLUS  = Skia.Path.MakeFromSVGString('M12 5L12 19M5 12L19 12')!;
const CLOSE = Skia.Path.MakeFromSVGString('M6 6L18 18M18 6L6 18')!;

export function MorphIcon({ progress, color, size = 24 }: { progress: SharedValue<number>; color: string; size?: number }) {
  const path = useDerivedValue(() => interpolatePath(progress.value, [0, 1], [PLUS, CLOSE]));
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} style="stroke" strokeWidth={1.75} strokeCap="round" color={color} />
    </Canvas>
  );
}
```
(Canvas coordinates are 24×24 here; scale with a `Group transform` if `size` ≠ 24.)

### 5.5 Hosting a shader on a photo (the core of the app)

```tsx
// src/filters/FilterLayer.tsx
import { Canvas, Fill, Shader, ImageShader, Skia, useImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { LIQUID_SKSL } from './shaders/liquid';

const effect = Skia.RuntimeEffect.Make(LIQUID_SKSL);
if (!effect) console.error('[liquid] SkSL failed to compile'); // fallback: render the plain image

type Props = {
  uri: string; width: number; height: number;
  amount: SharedValue<number>;
  origin: SharedValue<{ x: number; y: number }>;
  time: SharedValue<number>;
};

export function FilterLayer({ uri, width, height, amount, origin, time }: Props) {
  const image = useImage(uri);                         // null until loaded → show skeleton upstream
  const uniforms = useDerivedValue(() => ({
    resolution: [width, height],
    origin: [origin.value.x, origin.value.y],
    amount: amount.value,
    time: time.value,
  }));
  if (!image || !effect) return null;
  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width, height }} />
        </Shader>
      </Fill>
    </Canvas>
  );
}
```
Shaders can be nested (child `Shader`s) to chain passes and to build transitions — see `architecture.md` §6.

### 5.6 Velocity-aware slider (value is a SharedValue)

```tsx
// src/morph/MorphSlider.tsx
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { runOnJS } from '@/core/threads';
import { spring } from '@/core/motion';
import { color, radius } from '@/core/tokens';

type Props = { value: SharedValue<number>; width: number; onCommit?: (v: number) => void; label: string };
const THUMB = 28;

export function MorphSlider({ value, width, onCommit, label }: Props) {
  const vx = useSharedValue(0);
  const active = useSharedValue(0);

  const pan = Gesture.Pan()
    .hitSlop({ top: 16, bottom: 16, left: 8, right: 8 })
    .onBegin(() => { active.value = withSpring(1, spring.snappy); })
    .onChange((e) => {
      value.value = Math.min(1, Math.max(0, value.value + e.changeX / width));
      vx.value = e.velocityX;                       // no JS call per tick
    })
    .onFinalize(() => {
      vx.value = withSpring(0, spring.gooey);
      active.value = withSpring(0, spring.gooey);
      if (onCommit) runOnJS(onCommit)(value.value); // one JS call at the end
    });

  const fill = useAnimatedStyle(() => ({ width: value.value * width }));
  const thumb = useAnimatedStyle(() => {
    const s = interpolate(Math.abs(vx.value), [0, 2000], [1, 1.6], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: value.value * (width - THUMB) },
        { scaleX: s }, { scaleY: 1 / Math.sqrt(s) },            // squash & stretch
        { scale: 1 + active.value * 0.12 },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <View accessible accessibilityRole="adjustable" accessibilityLabel={label} style={{ width, height: 44, justifyContent: 'center' }}>
        <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: color.glassStrong }}>
          <Animated.View style={[{ height: 6, borderRadius: radius.pill, backgroundColor: color.accent.cyan }, fill]} />
        </View>
        <Animated.View style={[{ position: 'absolute', width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: color.text.primary }, thumb]} />
      </View>
    </GestureDetector>
  );
}
```
Add `accessibilityActions` (`increment`/`decrement`) for screen readers.

### 5.7 Staggered entrance

```tsx
<Animated.View entering={FadeInDown.delay(index * stagger.chips).springify().damping(spring.smooth.damping)} layout={LinearTransition.springify()} />
```

---

## 6. Shader (SkSL) authoring rules

**Contract (so `FilterLayer` and the export pipeline can treat every filter generically):**

```glsl
uniform shader image;       // child 0: the source (already adjusted)
uniform float2 resolution;  // canvas size
uniform float  amount;      // 0..1 master intensity
uniform float2 origin;      // effect center in px (always declared, even if unused)
uniform float  time;        // seconds (always declared, even if unused)
// + filter-specific float uniforms, named exactly like params[].key in the registry

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  // ... effect ...
  return mix(src, result, half(amount));
}
```

Example — Liquid ripple:

```glsl
uniform shader image;
uniform float2 resolution;
uniform float amount;
uniform float2 origin;
uniform float time;
uniform float frequency;   // 0.02 .. 0.12
uniform float strength;    // 4 .. 30

half4 main(float2 xy) {
  float2 d = xy - origin;
  float dist = length(d);
  float2 dir = d / max(dist, 0.001);
  float wave = sin(dist * frequency * 6.2831 - time * 6.0) * exp(-dist * 0.003);
  float2 uv = xy + dir * wave * strength * amount;
  return image.eval(uv);
}
```

Gotchas:
- Provide **every declared uniform** (a missing one throws). Extra keys in the uniforms object are ignored.
- SkSL is GLSL-ES-2-like: loops need **constant bounds**; use `mod()` not `%`; no `texture2D` — sample with `image.eval(coord)`.
- `smoothstep(e0, e1, x)` needs `e0 < e1`. For a falling edge write `1.0 - smoothstep(lo, hi, x)`.
- Coordinates are **canvas-local px** (same units as the Canvas size). Pass `resolution` and normalize yourself when you need 0..1.
- Keep texture taps ≤ 16 per pixel (Sobel = 9 is fine). For big blurs use Skia's `Blur` image filter, not a shader loop.
- Prefer `half` for colors, `float` for coordinates.
- Compile once at module scope. Log compile errors; fall back to the unfiltered image — never crash the editor.
- Port transitions from GL Transitions only if the file header says MIT; convert `getFromColor/getToColor(uv)` → `from.eval(xy)/to.eval(xy)` and uv → xy/resolution.

---

## 7. Performance checklist

- [ ] No React state updates while dragging, scrubbing, or animating
- [ ] Uniforms computed in `useDerivedValue` (worklet), not in render
- [ ] Preview image downscaled (≤ 1080 px long edge); full-res only at export
- [ ] ≤ 3 visible `Canvas`es per screen; prefer one canvas with layers
- [ ] Particles ≤ 120, drawn as Skia primitives
- [ ] ≤ 2 `BlurView`s on screen; opaque fallback if the frame budget is missed
- [ ] Lists: stable `keyExtractor`, memoized items, no per-item Canvas
- [ ] Idle loops stop when blurred/unfocused (`useFocusEffect`, `AppState`)
- [ ] No inline object/array creation inside worklets that run every frame when avoidable
- [ ] Verified with the dev perf monitor on a **mid-range Android** (target ≥ 55 fps UI + JS)

---

## 8. Accessibility checklist

- [ ] `useReducedMotion()` → crossfade only; no goo, particles, or idle loops
- [ ] Roles/labels/state set; sliders expose `accessibilityActions`
- [ ] Hit area ≥ 44×44 (`hitSlop`)
- [ ] Not color-only (active filter has label + ring)
- [ ] Canvas gestures have button equivalents (compare, undo, reset)

---

## 9. Anti-patterns (reject on sight)

| ❌ Don't | ✅ Do |
|---|---|
| `const [x, setX] = useState` updated in `onChange`/`onUpdate` | Shared value written in the worklet |
| Animate `width/height` with state | Animate `transform`/`opacity`, or interpolate a rect via shared values (container transform) |
| `Animated` from `react-native` | Reanimated |
| `useAnimatedGestureHandler` | `Gesture.Pan()` / `GestureDetector` |
| Hard-coded `#8B5CFF`, `borderRadius: 16`, `damping: 12` | `color.accent.violet`, `radius.md`, `spring.gooey` |
| Re-creating `RuntimeEffect` inside render | Module-level `Skia.RuntimeEffect.Make` |
| Full-res image in the preview canvas | Downscaled preview, full-res on export |
| A Canvas per list item | Static thumbnails (pre-rendered) or one shared canvas |
| Linear/`ease-in-out` on touch response | Springs with velocity hand-off |
| Appearing/disappearing without an origin | Container transform or an `entering`/`exiting` tied to the source |
| Unbounded loops that never stop | Loops tied to focus + AppState |

---

## 10. Definition of Done

- [ ] Follows `design.md` tokens, presets and principles
- [ ] All states implemented (idle, pressed, focused, disabled, loading, error)
- [ ] Origin/destination defined for every appearance
- [ ] No per-frame React renders (checked)
- [ ] Reduced-motion variant works
- [ ] A11y labels/roles/targets done
- [ ] `tsc --noEmit` and lint pass; no `any` without a comment
- [ ] Mid-range Android ≥ 55 fps for the interaction
- [ ] File header comment states: purpose · props · whether it needs a dev build

---

## 11. Prompt examples (copy/paste to your agent)

- "Using `SKILL.md`, build `MorphChip` for the filter dock: idle → active → expands (container transform) into the param sheet. Accept `accent: [string,string]`, `active: boolean`, `onPress`, `onLongPress`."
- "Using `SKILL.md`, add the `Vortex` filter: SkSL following the contract in §6, registry entry per `architecture.md` §6.2, `swirl` transition, `swirl-trails` visualizer, finger-controlled origin."
- "Using `SKILL.md`, build the live histogram HUD: 64 bins from a 96 px thumbnail, RGB additive layers, `interpolatePath` morph between old/new curves."
- "Using `SKILL.md`, build the liquid compare seam: wavy divider whose amplitude follows drag velocity, handle morphs circle↔pill."
- "Review this component against `SKILL.md` §9 and §10 and fix every violation."
