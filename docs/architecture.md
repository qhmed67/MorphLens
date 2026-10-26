# architecture.md — MorphLens Architecture

> **Product:** MorphLens — upload a photo, apply filters that visibly *flow* across the image, and watch live visualizations of what the pixels are doing.
> **Stack:** React Native (Expo) · TypeScript strict · Reanimated 4 · Skia · 100 % free / open-source
> **Companions:** `design.md` (tokens, motion, visual language) · `SKILL.md` (how to write components)
> **North-star goal:** the *power and beauty of the visualizations*. Every architectural decision below exists to keep Skia rendering on the GPU and React out of the frame loop.

---

## 1. Product scope

### 1.1 What the app does
1. **Import** a photo (gallery or camera).
2. **Browse** a dock of filters; each filter has live-tweakable parameters.
3. **Apply** a filter with "The Drop" choreography (`design.md` §3.3): a transition shader spreads from an origin point, a visualizer overlay plays, HUD graphs morph.
4. **Explore** via finger-controlled origin, pinch/pan zoom, long-press to see the original, liquid before/after seam.
5. **Export** at full resolution (JPG/PNG) and share.
6. **Recent edits** are stored locally as *recipes* (non-destructive), re-rendered on demand.

### 1.2 Non-goals (v1)
- No accounts, backend, cloud sync, analytics SDKs, ads, or paid APIs.
- No video editing, no RAW, no layers/masks, no light theme.
- No AI/ML filters (can come later with free on-device models).

### 1.3 Hard constraints
| Constraint | Consequence |
|---|---|
| **Zero budget** | Only MIT/Apache/BSD libraries, free fonts, self-written shaders. No Shadertoy copy-paste (CC BY-NC-SA). |
| **Expo Go compatible** | No custom native modules in v1. Anything needing a dev build is flagged and deferred. |
| **Mid-range Android ≥ 55 fps** | Downscaled preview, ≤ 3 canvases, one shader chain per frame, particles ≤ 120. |
| **Offline-first** | Everything runs on-device. |

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Expo (latest stable SDK), `expo-router` | Install every package via `npx expo install` |
| Language | TypeScript `strict: true` | Path alias `@/*` → `src/*` |
| Animation | `react-native-reanimated` 4 + `react-native-worklets` | Shared values, derived values, frame callbacks |
| Gestures | `react-native-gesture-handler` | `Gesture.Pan/Pinch/LongPress/Tap` composed |
| Graphics / shaders | `@shopify/react-native-skia` | `RuntimeEffect`, `Canvas`, offscreen surfaces |
| State | `zustand` (+ `persist` middleware) | App-level state only; **never per-frame values** |
| Image import | `expo-image-picker` | |
| Image resize | `expo-image-manipulator` | Produce the preview proxy |
| Files | `expo-file-system` | Originals, previews, exports, recipe JSON |
| Save to gallery | `expo-media-library` | |
| Share | `expo-sharing` | |
| Haptics | `expo-haptics` | See `design.md` §8 |
| Blur | `expo-blur` | ≤ 2 per screen, opaque fallback |
| Icons | `lucide-react-native` + `react-native-svg` | |
| Fonts | `@expo-google-fonts/space-grotesk`, `inter`, `jetbrains-mono` | |
| Persistence | zustand `persist` → `@react-native-async-storage/async-storage` | Recipes are small JSON; images live on the file system |
| Testing | `jest-expo`, `@testing-library/react-native` | Pure logic only (recipes, registry, math); visuals verified manually |
| Lint | ESLint (`eslint-config-expo`) + Prettier | |

**Babel:** `react-native-worklets/plugin` must be the **last** plugin in `babel.config.js`.

---

## 3. Folder structure

```
morphlens/
├─ app/                              # expo-router (thin: composition only)
│  ├─ _layout.tsx                    # fonts, GestureHandlerRootView, root overlay host
│  ├─ index.tsx                      # Home
│  ├─ editor/[id].tsx                # Editor
│  └─ +not-found.tsx
├─ src/
│  ├─ core/
│  │  ├─ tokens.ts                   # design.md §2
│  │  ├─ motion.ts                   # design.md §3.1
│  │  ├─ threads.ts                  # re-exports runOnJS / runOnUI (single adaptation point)
│  │  ├─ clock.ts                    # useClock(): shared time value via useFrameCallback
│  │  ├─ perf.ts                     # device tier detection, fps cap, quality presets
│  │  └─ types.ts                    # shared types (Vec2, Rect, Recipe…)
│  ├─ morph/                         # UI primitives (design.md §4) — one component per file
│  │  ├─ MorphPressable.tsx
│  │  ├─ MorphSurface.tsx
│  │  ├─ MorphChip.tsx
│  │  ├─ MorphSlider.tsx
│  │  ├─ MorphSwitch.tsx
│  │  ├─ MorphTabBar.tsx
│  │  ├─ MorphSheet.tsx
│  │  ├─ MorphToast.tsx
│  │  ├─ MorphNumber.tsx
│  │  ├─ MorphProgress.tsx
│  │  ├─ MorphSkeleton.tsx
│  │  ├─ MorphIcon.tsx
│  │  ├─ GooBlobs.tsx
│  │  ├─ MorphContainer.tsx
│  │  └─ useContainerTransform.ts
│  ├─ filters/
│  │  ├─ registry.ts                 # FilterDef[] — the single source of truth (§6.2)
│  │  ├─ types.ts                    # FilterDef, ParamDef, TransitionId, VisualizerId
│  │  ├─ pipeline.ts                 # builds the Skia shader chain from state (§6.4)
│  │  ├─ FilterLayer.tsx             # photo + shader chain (SKILL.md §5.5)
│  │  ├─ shaders/
│  │  │  ├─ adjust.ts                # exposure/contrast/saturation pre-pass
│  │  │  ├─ aurora.ts  liquid.ts  vortex.ts  glitch.ts  duotone.ts  noir.ts
│  │  │  ├─ thermal.ts cyberNeon.ts prism.ts pixelMorph.ts film.ts
│  │  │  ├─ dream.ts   halftone.ts  sketch.ts kaleidoscope.ts
│  │  │  └─ common.ts                # shared SkSL snippets (hash, noise, luma) — our own code
│  │  ├─ transitions/
│  │  │  ├─ radialGoo.ts  liquidWipe.ts  scanBars.ts  noiseDissolve.ts  swirl.ts
│  │  │  └─ index.ts                 # TransitionId → RuntimeEffect (compiled once)
│  │  └─ compile.ts                  # safe RuntimeEffect.Make + logging + fallback
│  ├─ visualizers/                   # overlay drawing, same canvas as the photo (§7)
│  │  ├─ types.ts
│  │  ├─ GooBurst.tsx  RippleRings.tsx  ScanBars.tsx  SwirlTrails.tsx
│  │  ├─ PixelCascade.tsx  GrainFlicker.tsx  EdgeTrace.tsx  BloomPulse.tsx
│  │  ├─ particles.ts                # fixed-size particle pool (≤ 120)
│  │  └─ index.ts                    # VisualizerId → component
│  ├─ hud/                           # data visualizations (§8)
│  │  ├─ HistogramHud.tsx  PaletteBlobs.tsx  HueRing.tsx  IntensityDial.tsx
│  │  ├─ CompareSeam.tsx             # liquid before/after divider
│  │  ├─ analysis/
│  │  │  ├─ histogram.ts             # 64-bin RGB + luma from RGBA bytes
│  │  │  ├─ palette.ts               # k-means (k=5) on 32×32
│  │  │  └─ hue.ts                   # hue distribution (36 buckets)
│  │  └─ useImageAnalysis.ts         # debounced thumbnail → stats pipeline
│  ├─ editor/
│  │  ├─ EditorCanvas.tsx            # the one hero Canvas: photo + overlay + seam + gestures
│  │  ├─ FilterDock.tsx              # carousel of MorphChips
│  │  ├─ ParamSheet.tsx              # chip → sheet container transform
│  │  ├─ EditorTopBar.tsx
│  │  ├─ useEditorGestures.ts        # pan/pinch/long-press/tap → shared values
│  │  ├─ useApplyFilter.ts           # orchestrates "The Drop" (§6.5)
│  │  └─ shared.ts                   # EditorShared: the bag of SharedValues (§5.1)
│  ├─ export/
│  │  ├─ renderFull.ts               # offscreen full-res render (§9.3)
│  │  ├─ save.ts                     # media-library + share
│  │  └─ ExportSheet.tsx
│  ├─ home/
│  │  ├─ RecentGrid.tsx  RecentCard.tsx  NewButton.tsx  EmptyState.tsx
│  │  └─ AuroraWordmark.tsx
│  ├─ library/
│  │  ├─ recipeStore.ts              # zustand persist: Recipe[]
│  │  ├─ files.ts                    # paths, copy-in, cleanup
│  │  └─ thumbnails.ts               # recipe → thumbnail render
│  └─ settings/
│     └─ settingsStore.ts            # reduceMotion override, haptics, quality tier
├─ assets/ (fonts via packages; sample photos CC0 only)
├─ design.md  architecture.md  SKILL.md  AGENTS.md
├─ babel.config.js  tsconfig.json  app.json
└─ __tests__/                        # recipe serialization, registry validation, analysis math
```

**Rules**
- `app/` files stay thin: they compose `src/` modules.
- `src/morph/` knows nothing about filters. `src/filters/` knows nothing about screens.
- Dependency direction: `app → editor/home/export → filters/visualizers/hud/morph → core`. Never upward.

---

## 4. Layered architecture & data flow

```
                 JS thread (React)                         UI thread (worklets)                  GPU (Skia)
┌──────────────────────────────────┐   ┌──────────────────────────────────────┐   ┌───────────────────────────┐
│ zustand: recipe, selection,      │   │ SharedValues (EditorShared):         │   │ Canvas draws:             │
│ settings, library                │   │  amount, params[], origin, time,     │   │  1. photo (ImageShader)   │
│            │                     │   │  transitionProgress, zoom/pan,       │──▶│  2. adjust pre-pass       │
│   discrete events only           │   │  compareX, touching, velocity        │   │  3. filter shader         │
│   (select filter, open sheet,    │──▶│                                      │   │  4. transition shader     │
│    commit slider, export)        │   │ useDerivedValue → uniforms           │   │  5. visualizer overlay    │
└──────────────────────────────────┘   │ useFrameCallback → time              │   │  6. compare seam          │
                                       └──────────────────────────────────────┘   └───────────────────────────┘
```

**Golden rule:** React renders only on *discrete* events (select filter, mount sheet, finish export). Every continuous value is a `SharedValue` consumed by Skia through `useDerivedValue`. There is **no** React state in the frame loop.

### 4.1 Event → effect, end to end ("apply a filter")
1. User taps a `MorphChip` → `useApplyFilter(filterId)` (JS thread, once).
2. It snapshots the *previous* look (`prevFilterId`, `prevParams`), writes the *new* ids into `recipeStore`, sets `origin` from the chip center (or last finger position), resets `transitionProgress = 0`.
3. `transitionProgress` animates to 1 with `withTiming(…, ease.emphasized, 700 ms)` — on the UI thread.
4. Skia re-evaluates uniforms every frame from shared values: the transition shader samples **both** looks (§6.3) and reveals new-over-old from `origin`.
5. The visualizer overlay reads the same `transitionProgress` and `origin` and draws itself.
6. On completion (`runOnJS` once): medium haptic, `prevFilterId = null`, histogram recompute scheduled (debounced).

---

## 5. State management

### 5.1 `EditorShared` — the SharedValue bag (UI-thread state)
Created once per editor session in `editor/shared.ts`, passed down by props/context (a context that never changes identity, so no re-renders).

```ts
export type EditorShared = {
  amount: SharedValue<number>;            // 0..1 master intensity
  params: SharedValue<Record<string, number>>; // current filter's numeric params, keyed like registry
  origin: SharedValue<Vec2>;              // effect centre, canvas px
  originTarget: SharedValue<Vec2>;        // finger target; origin springs toward it
  time: SharedValue<number>;              // seconds, from useClock (paused when unfocused)
  transition: SharedValue<number>;        // 0..1 apply-transition progress
  zoom: SharedValue<number>;
  pan: SharedValue<Vec2>;
  compareX: SharedValue<number>;          // 0..1 seam position
  compareActive: SharedValue<number>;     // 0..1 (long-press / compare tab)
  touching: SharedValue<number>;          // 0..1 → HUD collapses
  dragVelocity: SharedValue<number>;      // seam wave amplitude, slider squash
};
```

### 5.2 Zustand stores (JS-thread, discrete)
```ts
// library/recipeStore.ts
type Recipe = {
  id: string;
  createdAt: number;
  originalUri: string;           // file-system path (copied into app sandbox)
  previewUri: string;            // ≤1080 px proxy
  thumbUri: string;              // pre-rendered card thumbnail (static, no per-card Canvas)
  size: { width: number; height: number };     // original dimensions
  adjust: { exposure: number; contrast: number; saturation: number };
  filterId: string | null;
  params: Record<string, number>;
  amount: number;
  origin: { x: number; y: number };            // normalized 0..1 (resolution independent)
  version: 1;                                  // for migrations
};
```
- `recipeStore`: list + CRUD; persisted.
- `editorStore` (not persisted): `selectedFilterId`, `prevFilterId`, `sheetOpen`, `tab`, `exporting`.
- `settingsStore`: persisted; `quality: 'auto'|'high'|'low'`, `haptics`, `reduceMotionOverride`.

**Sync rule:** shared values are the live truth while editing; commit to `recipeStore` on `onCommit` (gesture end), on filter change, and on leaving the editor — never per tick. Origin is stored **normalized** so preview and export agree.

---

## 6. Filter system (the core)

### 6.1 Filter contract (what every filter must satisfy)

Every filter is **one SkSL fragment** plus a registry entry. The shader contract is in `SKILL.md` §6:

```glsl
uniform shader image;       // child 0: source (already adjusted)
uniform float2 resolution;
uniform float  amount;      // 0..1
uniform float2 origin;      // px
uniform float  time;        // s
// + filter-specific floats named EXACTLY like params[].key
half4 main(float2 xy) { ... return mix(src, result, half(amount)); }
```

Because the contract is uniform, `FilterLayer`, the transition system, thumbnail rendering and export treat all filters generically.

### 6.2 Registry entry

```ts
// filters/types.ts
export type TransitionId = 'radial-goo' | 'liquid-wipe' | 'scan-bars' | 'noise-dissolve' | 'swirl';
export type VisualizerId = 'goo-burst' | 'ripple-rings' | 'scan-bars' | 'swirl-trails'
  | 'pixel-cascade' | 'grain-flicker' | 'edge-trace' | 'bloom-pulse';

export type ParamDef = {
  key: string;                 // == SkSL uniform name
  label: string;
  min: number; max: number; default: number;
  step?: number;
  unit?: string;               // shown in mono next to the value
};

export type FilterDef = {
  id: string;
  name: string;
  category: 'color' | 'distort' | 'light' | 'style';
  sksl: string;                          // shader source
  params: ParamDef[];
  animated: boolean;                     // true → idle loop uses `time`
  usesOrigin: boolean;                   // true → finger controls origin
  transition: TransitionId;
  visualizer: VisualizerId;
  accent: readonly [string, string];     // from tokens (color.accent.*)
  tapsPerPixel: number;                  // documented cost; must be ≤ 16
  phase: 1 | 5;                          // ship order (design.md §7)
};
```

```ts
// filters/registry.ts (excerpt)
import { color } from '@/core/tokens';
import { LIQUID_SKSL } from './shaders/liquid';

export const FILTERS: FilterDef[] = [
  {
    id: 'liquid', name: 'Liquid', category: 'distort', sksl: LIQUID_SKSL,
    params: [
      { key: 'frequency', label: 'Frequency', min: 0.02, max: 0.12, default: 0.06, step: 0.001 },
      { key: 'strength',  label: 'Strength',  min: 4,    max: 30,   default: 14,   step: 0.5, unit: 'px' },
    ],
    animated: true, usesOrigin: true,
    transition: 'liquid-wipe', visualizer: 'ripple-rings',
    accent: [color.accent.cyan, color.accent.violet],
    tapsPerPixel: 1, phase: 1,
  },
  // …one entry per filter in design.md §7
];

export const FILTER_BY_ID = Object.fromEntries(FILTERS.map(f => [f.id, f]));
```

A unit test (`__tests__/registry.test.ts`) validates: unique ids, every `params[].key` appears as `uniform float <key>` in the SkSL, `default ∈ [min,max]`, `tapsPerPixel ≤ 16`, transition and visualizer ids exist.

### 6.3 Transition-shader contract

A transition blends the **previous look (`from`)** into the **new look (`to`)**, spreading from `origin`. Both are *children shaders* produced by the pipeline (each is "photo → adjust → filter").

```glsl
uniform shader from;        // previous look (or plain photo when none)
uniform shader to;          // new look
uniform float2 resolution;
uniform float  progress;    // 0..1, eased on the UI thread
uniform float2 origin;      // px
uniform float  time;
uniform float  seed;        // per-apply random for noise variety

half4 main(float2 xy) { ... return mix(from.eval(xy), to.eval(xy), half(mask)); }
```

Example — `radial-goo` (our own code):

```glsl
uniform shader from; uniform shader to;
uniform float2 resolution; uniform float progress; uniform float2 origin;
uniform float time; uniform float seed;

float hash(float2 p){ return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p){
  float2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + float2(1,0)), c = hash(i + float2(0,1)), d = hash(i + float2(1,1));
  float2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

half4 main(float2 xy) {
  float maxR = length(max(origin, resolution - origin)) * 1.05;
  float wobble = (noise(xy * 0.015 + seed) - 0.5) * 60.0 * sin(progress * 3.14159);
  float r = progress * maxR;
  float d = length(xy - origin) + wobble;
  float mask = 1.0 - smoothstep(r - 24.0, r + 24.0, d);   // falling edge: lo < hi
  return mix(from.eval(xy), to.eval(xy), half(mask));
}
```

Transition rules: `progress = 0` ⇒ pixel-identical to `from`; `progress = 1` ⇒ pixel-identical to `to`. Never read outside `[0, resolution]` without clamping.

### 6.4 Render pipeline (one Skia canvas, one chain)

```
photo (ImageShader, fit=cover, preview proxy)
  └─► adjust pre-pass  (exposure / contrast / saturation)
        ├─► filter(prev)  ─┐
        └─► filter(next)  ─┴─► transition(progress, origin) ─► [compare seam mask vs plain photo]
                                                            └─► visualizer overlay (Skia primitives)
```

- `pipeline.ts` exports `buildChain(effects, uniforms)` returning nested `<Shader>` children. Child shaders are only nested while `transition < 1`; at rest it is a **single** filter pass (cheap).
- Uniforms are computed in `useDerivedValue` from `EditorShared` — never in render.
- The compare seam is another small shader (`seam`) that picks the filtered or original sample on either side of a wavy line whose amplitude comes from `dragVelocity`.
- **Fallback:** if any `RuntimeEffect` is `null` (compile failure), render the plain photo and show a `MorphToast` error once — never crash.

### 6.5 "The Drop" orchestration (`useApplyFilter`)
Implements `design.md` §3.3 timings with shared-value animations:

| Step | Implementation |
|---|---|
| chip morph + haptic | `MorphChip` internal springs, `Haptics.impactAsync(Light)` on press-in |
| set origin | `originTarget.value = canvasPoint(chipCenter)`; `origin` springs toward it (`spring.smooth`) |
| transition | `transition.value = withTiming(1, { duration: 700, easing: ease.emphasized }, done → runOnJS(onSettled)())` |
| visualizer | reads `transition`; draws between progress 0.05→1 |
| histogram morph | `useImageAnalysis` triggers after settle; `interpolatePath` old→new, `spring.smooth` |
| settle | Medium haptic; if `animated`, idle loop begins via `time` |

Interruptible: tapping another chip mid-transition snapshots the *current blended look* by promoting `next → prev`, resetting `transition = 0`. No locked input.

### 6.6 Idle loops & shared clock
`core/clock.ts` exposes `useClock()` using `useFrameCallback`, writing seconds to `time`. It **pauses** on blur (`useFocusEffect`) and when `AppState !== 'active'`. On low-tier devices it throttles writes to ~30 fps. Static filters never subscribe.

---

## 7. Visualizer overlays

Each overlay is a Skia component rendered **inside the same `Canvas`** (one GPU pass) on top of the filtered image.

```ts
export type VisualizerProps = {
  width: number; height: number;
  origin: SharedValue<Vec2>;
  progress: SharedValue<number>;     // apply progress 0..1
  time: SharedValue<number>;
  accent: readonly [string, string];
  reduced: boolean;                  // true → render nothing or a single opacity flash
};
```

- **Particle pool:** `particles.ts` preallocates a typed array (`Float32Array` of `N*4`: x, y, vx, vy) with **N ≤ 120**, advanced inside `useDerivedValue` and drawn with a single `Points`/`Atlas`-style primitive or a batched `Path`. No per-particle React nodes.
- **Edge-trace / pixel-cascade** use a cheap analysis texture: a Sobel pass shader (9 taps) rendered into an offscreen image once per apply, then animated along its contour via a `trim` on a path or a threshold shader.
- Visualizers are **stateless** functions of `(progress, origin, time, seed)` so scrubbing and interruption just work.
- Reduced motion: overlays disabled, transition becomes opacity blend (`design.md` §9).

---

## 8. Data visualizations (HUD)

### 8.1 Analysis pipeline (`useImageAnalysis`)
1. Trigger: filter settle, or **150 ms after** the last param change (debounce on the JS side from `onCommit`, not per tick).
2. Render the *current look* to a **96 px** offscreen surface (`Skia.Surface.MakeOffscreen`) using the same chain at `transition = 1`.
3. `surface.makeImageSnapshot().readPixels()` → `Uint8Array` RGBA (≈ 96×96×4 = 36 KB).
4. Compute in a worklet / small JS loop: histogram (64 bins × R,G,B,luma), 5-colour palette, 36-bucket hue distribution.
5. Smooth (3-tap), normalize, write into shared values (`histPath` as `SkPath` built with a **fixed point count** so `interpolatePath` always works).

Everything here is O(36 k) pixels — negligible. Never read pixels at preview size per frame.

### 8.2 Components
| Component | Input | Output |
|---|---|---|
| `HistogramHud` | before/after bin arrays | gradient path per channel + luma stroke, morph via `interpolatePath` |
| `PaletteBlobs` | 5 colours | `GooBlobs` drifting on Lissajous curves; cross-morph colours on change |
| `HueRing` | 36 buckets before/after | arc segments, rotation animates on colour filters |
| `IntensityDial` | `amount` SharedValue | ring trim + `MorphNumber` |
| `CompareSeam` | `compareX`, `dragVelocity` | wavy divider path, handle circle↔pill |

HUD collapses into one pill while `touching > 0` (`design.md` §5.3).

---

## 9. Image pipeline

### 9.1 Import
`expo-image-picker` → copy original into `FileSystem.documentDirectory/originals/<id>.<ext>` → generate:
- `preview` (long edge ≤ **1080**, JPEG q 0.9) via `expo-image-manipulator`
- `thumb` (long edge 320) for Home cards

Respect EXIF orientation when resizing (manipulator normalizes it). Large images (> 12 MP) are processed once at import, never at render time.

### 9.2 Preview rendering
`useImage(previewUri)` (Skia). Show `MorphSkeleton` until non-null. Photo is fitted with `fit="cover"`/`contain` into the canvas; zoom/pan is a Skia matrix built from shared values.

### 9.3 Export (full resolution)
```
load original → Skia.Surface.MakeOffscreen(w, h)   // clamp long edge to 4096 (GPU texture limit safety)
  → draw same chain with: resolution = (w,h), origin = recipe.origin × (w,h),
                          time = frozen, transition = 1, compareActive = 0
  → makeImageSnapshot().encodeToBase64(format, quality)
  → FileSystem.writeAsStringAsync(cache/…, base64, Base64)
  → MediaLibrary.saveToLibraryAsync / Sharing.shareAsync
```
- **Shader parameters that are in pixels** (`strength`, `frequency`) are defined relative to **preview size**; export multiplies them by `scale = exportLongEdge / previewLongEdge`. Declare this per param with `ParamDef.unit === 'px'` → the exporter scales it automatically.
- Progress is reported via a SharedValue to `MorphProgress`; on success the ring morphs to a check.
- Permission denied → `MorphToast` with an action to open settings; never silent failure.

### 9.4 Recent-edits thumbnails
Thumbnails are **pre-rendered static images** (render recipe at 320 px once, save JPEG). The Home grid never mounts a Canvas per card (`SKILL.md` §9).

---

## 10. Navigation & screen transitions

| Route | Screen | Transition |
|---|---|---|
| `/` | Home | — |
| `/editor/[id]` | Editor | **Container transform** from the tapped `RecentCard` (or from the New button after picking) |
| Export | Modal `MorphSheet` inside the editor (not a route) | Save button → progress ring → check |

- A root-level **overlay host** in `_layout.tsx` renders container-transform panels so `measureInWindow` coordinates match (`SKILL.md` §5.2).
- Use `expo-router` with `animation: 'none'` on the editor route and let the container transform own the motion; provide an `entering` fade fallback under reduced motion.
- Back gesture is a button equivalent of the collapse animation (interruptible).

---

## 11. Performance architecture

| Budget | Value | How enforced |
|---|---|---|
| UI + JS fps (mid-range Android) | ≥ 55 | Dev perf monitor, manual test checklist per phase |
| Preview long edge | ≤ 1080 px | Import pipeline |
| Visible Canvases | ≤ 3 | Editor: 1 hero + HUD canvases (histogram, palette) |
| Shader taps / pixel | ≤ 16 | Registry test (`tapsPerPixel`) |
| Particles | ≤ 120 | Pool size constant |
| BlurViews | ≤ 2 | Code review + `MorphSurface` fallback |
| Frame callback | single global clock | `core/clock.ts` |

**Quality tiers** (`core/perf.ts`): `high` / `medium` / `low`, chosen on first launch by a 1-second synthetic frame-time probe (or `settingsStore.quality`). Tiers adjust: idle-loop fps cap (60/30/24), particle count (120/80/40), blur on/off, preview long edge (1080/900/720), goo layers on/off. Components read the tier; none hard-code behaviour.

**Idle policy:** all loops (aurora wordmark, breathing New button, animated filters, drifting palette) stop on blur/background.

---

## 12. Error handling & resilience

| Failure | Behaviour |
|---|---|
| SkSL compile error | Log (with filter id) → show plain photo → one `MorphToast` error → filter chip marked disabled |
| Image load failure | Error state card with retry; recipe kept |
| Out-of-memory / huge image | Import refuses > 50 MP with a friendly message |
| Export failure | Toast + retry; partial files cleaned from cache |
| Missing uniform | Caught by registry unit test (CI) before runtime |
| Corrupt persisted store | `persist` `version` + `migrate`; fall back to empty library, never crash |

An `ErrorBoundary` wraps the editor; on crash it returns to Home with the recipe preserved.

---

## 13. Testing & verification

- **Unit (jest):** recipe (de)serialization and migration, registry validation, histogram/palette/hue math with fixed fixtures, export scale factor.
- **Manual checklists (per phase):** the Definition of Done in `SKILL.md` §10 + the acceptance list in `design.md` §11.
- **Visual regression (optional, free):** render each filter at `transition=1` into an offscreen surface in a debug screen and eyeball the grid after shader changes.
- CI (GitHub Actions free tier): `tsc --noEmit`, `eslint`, `jest`.

---

## 14. Delivery phases

| Phase | Goal | Exit criteria |
|---|---|---|
| **0 — Foundation** | Expo project, tokens, motion, threads, fonts, router shell, root overlay host | App boots in Expo Go; `tsc` + lint pass |
| **1 — Primitives** | `MorphPressable`, `MorphSurface`, `MorphSwitch`, `MorphSlider`, `MorphIcon`, `GooBlobs`, `MorphSkeleton` | Component gallery screen; all states; reduced-motion OK |
| **2 — Canvas & first filter** | Import, preview proxy, `EditorCanvas`, `FilterLayer`, **Liquid** with finger origin | 60 fps drag of origin on mid-range Android |
| **3 — The Drop** | Transition system (5 transitions), `useApplyFilter`, `MorphChip` dock, 6 launch filters (Aurora, Liquid, Vortex, Glitch, Duotone, Noir), visualizers for them | Full choreography matches `design.md` §3.3 timings |
| **4 — HUD** | Analysis pipeline, histogram, palette blobs, hue ring, intensity dial, compare seam | Histogram morphs on filter change; HUD collapses on touch |
| **5 — Catalog** | Remaining 9 filters + visualizers (`design.md` §7) | Every registry test green; perf budget held |
| **6 — Library & export** | Recipes persistence, Home grid with container transform, export sheet, save/share | Round-trip: edit → close → reopen identical; export matches preview |
| **7 — Polish** | Quality tiers, haptics pass, a11y pass, error states, icon morphs everywhere, empty states | Full a11y + reduced-motion audit |

**Ship order inside a phase:** logic first (types, registry, store), then visuals, then polish. Commit after each green step.

---

## 15. Free resources & licensing

| Need | Source | License |
|---|---|---|
| Libraries | npm packages listed in §2 | MIT / Apache-2.0 |
| Fonts | Google Fonts | OFL |
| Icons | Lucide | ISC |
| Shaders | **Written in-house**; Inigo Quilez articles for *techniques* (re-implement, don't copy blindly); GL Transitions only if file header says MIT | — |
| Sample photos | Unsplash / Pexels / Wikimedia CC0 | Check per image |
| Distribution (when ready) | EAS Build free tier (queue limits), Google Play one-time fee is the only unavoidable cost; sideload APK is free | — |

---

## 16. Conventions

- **Naming:** components `PascalCase.tsx`; hooks `useX.ts`; shader sources `name.ts` exporting `NAME_SKSL`.
- **Imports:** always via `@/…`; no relative `../../`.
- **File header:** purpose · props · "needs dev build?" (`SKILL.md` §10).
- **Commits:** conventional (`feat(filters): add vortex`), one logical step each.
- **Never** invent tokens, springs, or durations — add to `tokens.ts` / `motion.ts` first.
- **When unsure of an API,** read the docs for the *installed* version (links in `SKILL.md` §0) before writing code.

---

## 17. Starter prompts for the coding agent

1. *"Read `design.md`, `architecture.md`, `SKILL.md`. Execute **Phase 0**: scaffold the Expo project per §3 of architecture.md, create `tokens.ts`, `motion.ts`, `threads.ts`, install fonts, set up expo-router and the root overlay host. Stop when `tsc --noEmit` passes and the app boots."*
2. *"Execute **Phase 1**. Build the primitives in order: MorphPressable, MorphSurface, MorphSwitch, MorphSlider, MorphIcon, GooBlobs, MorphSkeleton. Add a `/gallery` route showing every state. Follow SKILL.md §3 workflow and §10 DoD."*
3. *"Execute **Phase 2**: image import + preview proxy (§9.1), `EditorShared` (§5.1), `FilterLayer`, the Liquid filter with finger-controlled origin. Verify no React re-renders while dragging."*
4. *"Execute **Phase 3**: transition shaders per §6.3, `useApplyFilter` per §6.5, `MorphChip` + `FilterDock`, and the six launch filters with their visualizers."*
5. *"Review the whole repo against `SKILL.md` §9 anti-patterns and `design.md` §11; list and fix every violation."*

---

## 18. Course-project addendum — Image Processing Engine & Lab mode

> **Context:** MorphLens is also a university *Image Processing* course project. The instructor wants (a) fresh, non-repeated ideas, (b) real image-processing functions that modify images (colour changes, noise removal, enhancement), (c) a UI plus a business-logic/"backend" layer that owns those functions, (d) React Native. First review is **~4 weeks after 2026-10-18 (≈ 2026-11-15)**. The impressive part must be the **visuals**: the audience should *see* the algorithms working.
> **Precedence:** §18 overrides §3, §6 and §14 wherever they conflict. Everything else (design.md, SKILL.md, tokens, motion, performance budgets) stays binding.

### 18.1 Two modes, one app
| Mode | Purpose | Tech |
|---|---|---|
| **Creative** | The artistic filters from `design.md` §7 (real-time GPU, The Drop choreography) | Skia SkSL (§6) |
| **Lab** | Classical image-processing algorithms with *visual explanations* — the part the course is graded on | Pure-TS engine (§18.2) + Skia visualizers |

Home offers both as two large morphing cards. If time runs short, **Lab wins over Creative**; ship only the 6 launch filters.

### 18.2 The "backend": `src/engine/` (business logic, UI-free)
The engine is plain TypeScript with **no React, Skia or Reanimated imports**, so it is unit-testable in Jest and explainable in a viva. The UI calls it through one facade (`engine/index.ts`); screens never touch pixels directly.

```
src/engine/
├─ types.ts            # ImageBuffer, Kernel, OperationDef, Metrics
├─ buffer.ts           # create/clone/fromRGBA/toRGBA, getPixel w/ border handling (clamp|reflect|zero)
├─ color/
│  ├─ spaces.ts        # RGB↔HSV, RGB↔HSL, RGB↔YCbCr, RGB↔CIE Lab (D65)
│  ├─ adjust.ts        # brightness, contrast, gamma, saturation, hue shift
│  ├─ balance.ts       # gray-world & white-patch white balance
│  ├─ transfer.ts      # Reinhard colour transfer (match another image's mood)
│  └─ effects.ts       # grayscale (luma weights), sepia, invert, channel mixer, duotone, posterize
├─ noise/
│  ├─ generate.ts      # gaussian, salt-and-pepper, speckle noise (seeded PRNG → deterministic tests)
│  ├─ denoise.ts       # mean, gaussian, median, adaptive median, bilateral, (stretch) non-local means
│  └─ metrics.ts       # MSE, PSNR, SSIM (global + 8×8 windowed)
├─ enhance/
│  ├─ histogram.ts     # histogram, CDF, equalization (luma-only), histogram matching
│  ├─ clahe.ts         # contrast-limited adaptive equalization
│  ├─ sharpen.ts       # unsharp mask, laplacian sharpen
│  └─ stretch.ts       # contrast stretching, auto-levels
├─ spatial/
│  ├─ convolve.ts      # generic convolution, separable fast path
│  ├─ kernels.ts       # box, gaussian(σ), sobel, prewitt, laplacian, LoG, emboss
│  ├─ edges.ts         # sobel/prewitt magnitude+direction, Canny (gauss→sobel→NMS→hysteresis)
│  └─ morphology.ts    # erode, dilate, open, close, gradient, top-hat (on binary/gray)
├─ frequency/
│  ├─ fft.ts           # radix-2 FFT/IFFT (1-D) + 2-D, fftshift, zero-padding to power of 2
│  └─ filters.ts       # ideal/gaussian/butterworth low-pass, high-pass, band-pass masks
├─ registry.ts         # OperationDef[]: id, name, category, params, run(), explanation, formula
└─ index.ts            # facade: runOperation(id, buffer, params, onProgress?) → ImageBuffer
```

```ts
export type ImageBuffer = {
  width: number; height: number;
  data: Uint8ClampedArray;          // RGBA, row-major, 4 bytes/pixel
};
export type OperationDef = {
  id: string; name: string;
  category: 'color' | 'noise' | 'enhance' | 'spatial' | 'frequency' | 'morphology';
  params: ParamDef[];               // same ParamDef as §6.2 (reuse, don't duplicate)
  run: (src: ImageBuffer, p: Record<string, number>, ctx?: RunCtx) => ImageBuffer;
  explain: { summary: string; formula: string; whenToUse: string }; // shown in the Explain panel
  cost: 'light' | 'medium' | 'heavy';
};
```

**Engine rules**
1. Pure functions; never mutate the input; deterministic (seeded PRNG for noise).
2. Intermediate math in `Float32Array`/numbers; clamp only when writing bytes.
3. Every algorithm has a comment block: *what it does · the formula · complexity · edge cases* (the instructor can read this file and learn from it).
4. Border handling is an explicit parameter, tested.
5. Long operations accept `RunCtx { onProgress(0..1); shouldCancel(): boolean }` and process in row bands.
6. **Execution:** engine runs on a **≤ 512 px proxy** for interactive use. Heavy ops (`median ≥ 5×5`, `bilateral`, `clahe`, `fft`, `canny`) run off the UI path: prefer a Worklets background runtime (check the installed `react-native-worklets` docs for the current API); fallback is chunked execution on the JS thread that yields between bands (`await nextFrame()`), so the UI never freezes. Full-resolution runs happen only on export.
7. Engine output → Skia image via `Skia.Image.MakeImage({ width, height, alphaType, colorType }, Skia.Data.fromBytes(bytes), width * 4)`; reading pixels back uses an offscreen surface (§8.1). Wrap this in `src/engine/bridge/skia.ts` — the **only** engine-adjacent file allowed to import Skia.
8. Light, per-pixel ops (brightness, contrast, gamma, saturation, hue, grayscale, sepia, invert, threshold) **also** exist as SkSL for 60 fps live sliders; the TS version is the *reference* and a unit test compares the two on a fixture (tolerance ±2/255).

### 18.3 Lab screens — "Algorithm Theatre" (fresh ideas, each is a visual demo)

| # | Screen | Course topic | The visual (what wows) |
|---|---|---|---|
| 1 | **Convolution Explainer** | Spatial filtering | A glowing kernel window slides over a magnified patch; each output pixel is computed on screen (the 3×3 numbers multiply & sum, then the result pixel "pops" into the output grid). Kernel is editable; presets: identity, blur, sharpen, sobel, emboss. Speed slider with velocity-aware scrubbing. |
| 2 | **Denoise Arena** | Noise models & restoration | Inject noise (gaussian / salt-and-pepper / speckle, amount slider) → run 4 filters side by side (mean, gaussian, median, bilateral). Live **PSNR/SSIM** badges (rolling `MorphNumber`) and a **difference heatmap** toggle (error shown as hot colours). Winner crown morphs onto the best card. Results fill in one card at a time on a 192 px proxy, so the screen paints immediately and a superseded run is cancelled. |
| 3 | **Histogram Surgery** | Intensity transforms | Live 64-bin luma histogram + CDF on a 96 px analysis proxy; equalization, CLAHE and contrast stretch compared across a draggable liquid seam. A five-point tone curve builds the 256-entry `applyLut` table. Before/after histograms and both CDFs share one canvas; equalize/CLAHE/stretch expose only their meaningful controls (luma/RGB range, tile count + clip). |
| 4 | **Frequency Playground** | Fourier transform | *Built, then removed by the owner (2026-10-21).* The engine operation `radialMask` (a radial gain on the spectrum) stays in the catalogue for the Trace. |
| 5 | **Colour Space Explorer** | Colour models | The photo's pixels as a **3-D point cloud** in RGB cube / HSV cone / Lab (rotatable by drag — projection done in worklet, ≤ 2 000 sampled points drawn as Skia points). Moving a hue/saturation slider visibly moves the cloud. Channel-split view (R,G,B,H,S,V,L,a,b as grayscale tiles). |
| 6 | **Edge Detection Race** | Edges & segmentation | Sobel vs Prewitt vs Laplacian vs Canny drawn as animated neon traces over the photo; Canny stages (blur → gradient → non-max suppression → hysteresis) scrubbed with a timeline. Threshold sliders. |
| 7 | **Morphology Sandbox** | Morphological ops | Threshold the image, choose a structuring element (disk/square/cross, size), watch erode/dilate/open/close animate pixel growth/shrink; top-hat reveals small bright details. |
| 8 | **Enhance Studio** | Practical enhancement | One-tap "Auto Enhance" pipeline shown as a **stepper**: white balance → denoise → CLAHE → unsharp mask. Every stage buffer is cached, so tapping a chip shows that step's own before/after on the photo without re-running the pipeline; each step can be switched off. |
| 9 | **Colour Transfer** | Colour manipulation | Pick a reference photo; Reinhard transfer in Lab recolours the source; palette blobs show the mean/σ shift. |

*Minimum for the first review (week 4):* screens **1, 2, 3** and **8** polished (screen 4 was cut by the owner). Screens 5–7, 9 are stretch goals. The Primitives gallery and the Creative mode were removed on 2026-10-21 — the Home shows only *Edit a photo* and *Lab mode*.

Every Lab screen has an **Explain** MorphSheet (summary + formula rendered in mono + "when to use"), pulled from `OperationDef.explain`, plus an in-widget **PhotoChooser** so the theatre always runs on a photo the user picked. The user-facing **Operation log** from the original spec was removed by owner revision R2; the maths/code motion panel in Trace is the replacement explanation surface. Every Explain sheet now also carries `ArabicOperationGuide`, a collapsed per-filter idea drawn from `src/lab/arabicExplain.ts`; Trace's bottom panel adds an **عربي** tab beside Maths/Code for the same content on the user's photo. Convolution also carries the richer owner-requested **ArabicGuide** (image-as-numbers → edge-as-difference → sliding 3×3 → multiply/add → Σ → 190 worked example → Identity/Blur/Sharpen), and **Kernel & border** renders Clamp/Reflect/Zero as selectable cards with a shaded top-left corner example (3×3 average kernel → 59/76/30), because the real border change is only the outermost 1-pixel ring. The convolution defaults are the spatial identity (`0 0 0 / 0 1 0 / 0 0 0`); `parseKernelWeight` reverts empty/invalid text instead of turning it into zero. `MiniMatrix` is the shared 3×3 numeric visual. Denoise Arena uses a 192 px proxy, paints the clean source and noisy input immediately, commits each filter frame/metric independently, cancels superseded runs, and retires replaced SkImages a frame later; this keeps the four-card screen responsive and never blank while the bilateral pass finishes.

The other Week 3 screens follow the same shape. **Frequency Playground** (`/lab/spectrum`) computes the log-magnitude spectrum once per photo, then lets the user drag a radial mask on it; the new engine operation `radialMask` (`src/engine/frequency/mask.ts`) reuses `applyFrequencyMask`, and the cutoff maps to the ring radius because the radial frequency of a pixel is its distance from the (shifted) DC divided by the spectrum width. The inverse transform runs on a 128 px proxy while the finger is down and on the 256 px proxy when it lifts, and superseded runs are cancelled by sequence number. **Enhance Studio** (`/lab/enhance`) runs white balance → denoise → CLAHE → unsharp mask and caches the buffer after every step, so the stepper chips can show a step's own before/after for free. **Creative mode** was built and then **removed by the owner** (2026-10-21 — "not needed"): the app now has two doors, *Edit a photo* (the editor) and *Lab mode*. The six launch filters (`src/engine/creative/filters.ts`) stay in the engine as documented algorithms, and the SkSL twins plus the five transition shaders (W3.9/W3.10) remain open.

 a 512 px display proxy feeds a 96 px analysis copy; a live 64-bin histogram and CDF sit over a before/after liquid-seam comparison; equalize, CLAHE, stretch and a five-point tone curve share the same debounced pipeline. The curve maps to a 256-entry LUT through `buildToneLut` and runs in the new `applyLut` engine pass; the screen retires replaced SkImages after the canvas swaps and cancels superseded runs by sequence number.

### 18.4 Layered view (UI ↔ business logic)

```
 UI (app/, src/editor, src/lab, src/morph)  ── discrete events, shared values ──▶
 Facade  src/engine/index.ts  (runOperation, listOperations, metrics)  ──▶
 Engine  pure TS algorithms (no UI imports)  ──▶  ImageBuffer
 Bridge  src/engine/bridge/skia.ts  (ImageBuffer ⇄ Skia image)  ──▶  Skia canvas / visualizers
```
Add `src/lab/` (screens + visualizers: `KernelTheatre`, `DenoiseArena`, `HistogramSurgery`, `SpectrumPlayground`, `ColorCloud`, `EdgeRace`, …) and `src/engine/`. Recipes (§5.2) gain an optional `ops: {id, params}[]` list so engine operations are non-destructive too.

### 18.5 Testing (mandatory, Jest — no device needed)
- **Fixtures:** tiny synthetic images built in code (gradient ramp, checkerboard, impulse pixel, 8×8 constant, known 3×3 patch) — no binary assets.
- **Property tests:** convolution with identity kernel = input; box blur of constant image = constant; median removes isolated salt noise; equalization output CDF ≈ linear; `FFT → IFFT ≈ identity (ε < 1e-4)`; colour-space round-trips (`RGB→HSV→RGB`, `RGB→Lab→RGB`) within ±1; PSNR of identical images = ∞ (guarded), PSNR monotonic with noise amount (fixed seed).
- **Known-value tests:** hand-computed 3×3 convolution outputs, Sobel on a vertical step edge, grayscale of pure R/G/B, morphology on a 5×5 plus-shape.
- **Reference-vs-shader test:** TS light ops vs their SkSL counterparts' documented formulas (formula parity), tolerance ±2.
- Registry test (§6.2) extended: every `OperationDef` has `explain.*`, valid params, and runs on the 8×8 fixture without throwing.
- Target: **≥ 85 % line coverage on `src/engine/`**; `npm test` must pass before any phase is declared done.

### 18.6 Documentation & commenting standard
- Every exported function: TSDoc (`/** … */`) with purpose, params, returns, complexity.
- Every algorithm file starts with a header comment: theory in 5–10 lines + formula + reference (textbook chapter name, e.g. *Gonzalez & Woods, Digital Image Processing*) — no copied text.
- Non-obvious lines get inline comments explaining *why*. Comments in English.
- A `docs/ALGORITHMS.md` is generated manually per algorithm: what, formula, parameters, pros/cons, screenshot placeholder. It doubles as the viva cheat sheet.

### 18.7 Git workflow (also in `AGENTS.md`)
- `git init` locally is allowed. **Do not set `user.name` / `user.email`, do not commit, do not push** until the owner provides a name and email in chat.
- After the owner provides identity: commit with per-command identity (`git -c user.name="…" -c user.email="…" commit …`) — never write it to global config — and add the trailer `Co-authored-by: opencode <noreply@opencode.local>`.
- Never add a remote or push. Conventional commit messages, one logical step per commit.

### 18.8 Revised 4-week roadmap (overrides §14 ordering)
| Week | Deliverable | Exit gate |
|---|---|---|
| **1** | Phase 0 foundation + primitives (§14 P0–P1, trimmed: Pressable, Surface, Slider, Switch, Sheet, Chip, GooBlobs, Skeleton) · engine core (`buffer`, `convolve`, `kernels`, `color/spaces`, `color/adjust`, `noise/generate`, `noise/metrics`, `histogram`) **with tests** · image import + preview proxy | `npm test` green, app boots in Expo Go, import → display works |
| **2** | Engine complete for the MVP set (denoise ×4, equalize, CLAHE, sharpen, white balance, edges, `fft` + filters) with tests · bridge to Skia · **Convolution Explainer** + **Denoise Arena** screens | Both screens demo-able at ≥ 55 fps interaction; coverage ≥ 85 % |
| **3** | **Histogram Surgery** + **Enhance Studio** (the Frequency Playground and the Creative canvas were cut by the owner) | Full Lab demo path without crashes |
| **4** | Polish & buffer: Colour Space Explorer / Edge Race if time · Explain sheets for every op · Home + container transforms · export · a11y/reduced-motion · `docs/ALGORITHMS.md` · demo script & sample photos | Rehearsed 5-minute demo; APK/Expo Go ready |

> **Cut order if late:** Colour Transfer → Morphology → Edge Race → Colour Explorer → extra Creative filters. Never cut tests, comments, or Denoise Arena / Convolution Explainer / Frequency Playground.
