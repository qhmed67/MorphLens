# design.md — MorphLens Design System

> **Working title:** MorphLens (rename freely)
> **Design language:** Morph UI — free edition (no paid library, no paid asset)
> **Platform:** React Native (Expo) · iOS + Android · light-first monochrome
> **Audience:** you and any AI coding agent. Every rule here is binding unless you consciously change it in this file.

Companion files: `architecture.md` (what we build and how it is wired) · `SKILL.md` (how to write any component).

---

## 0. What "Morph UI" means in this project

"Morph UI" is **not a library we install**. It is a design language: *surfaces that transform into each other instead of appearing and disappearing.* We reproduce it with free, MIT-licensed tools:

| Morph UI idea | Free implementation |
|---|---|
| Shape → shape (button becomes sheet, card becomes screen) | Reanimated shared values + `measureInWindow` + animated `left/top/width/height/borderRadius` (container transform) |
| Gooey / liquid blobs that merge and split | Skia: `Blur` + `ColorMatrix` alpha-threshold on a `Group layer` |
| Icon → icon, outline → outline | Skia `interpolatePath` between SVG paths with equal command structure |
| Real-time image effects | Skia `RuntimeEffect` (SkSL shaders) driven by Reanimated shared values |
| Frosted depth | `expo-blur` (sparingly) + translucent layers + hairline strokes |
| Physical feel | Springs with velocity hand-off from gestures, plus haptics |

**Rule zero — Continuity.** Nothing appears from nowhere. Everything is born *from* something the user already saw and dies *into* something they can still follow with their eyes.

---

## 1. Principles

1. **Continuity** — every transition has a visible origin and destination (the tapped chip is the origin of the effect it triggers).
2. **Liquidity** — shapes have momentum. They stretch with velocity, overshoot slightly, then settle. Nothing moves linearly.
3. **Photo first** — the user's image is the hero. Chrome is translucent, small, and gets out of the way. The strongest colors on screen should come from the photo and the active filter, never from the UI.
4. **Visual feedback > text** — a filter is explained by *what it does to the pixels*, shown live, not by a description.
5. **Physicality** — touch response in under 100 ms; every press, drag, and release has a spring and a haptic.
6. **Restraint** — one hero motion per interaction, supporting motions are quieter. Motion has a purpose; no decorative looping unless it is the filter's signature.
7. **UI-thread or nothing** — animation values live in Reanimated shared values / Skia, never in React state.

---

## 2. Visual foundation (tokens)

Light-first **monochrome** (owner directive 2026-10-20: "white and black and gray … not purple and cyan"). The page is paper, chrome is ink/graphite, and the photo supplies every other colour. A single dark surface is allowed: the photo window in Trace/visualizer screens, where white edge maps must stay legible. Dark theme is out of scope. **Never hard-code values in components — import tokens.**

```ts
// src/core/tokens.ts (verbatim)
export const color = {
  bg: { 0: '#F6F5F1', 1: '#FFFFFF', 2: '#EDECE7', 3: '#E1E0D9' },
  glass: 'rgba(255,255,255,0.66)',
  glassStrong: 'rgba(255,255,255,0.86)',
  stroke: 'rgba(20,20,18,0.10)',
  strokeStrong: 'rgba(20,20,18,0.20)',
  photoStroke: 'rgba(255,255,255,0.22)',
  photoStrokeStrong: 'rgba(255,255,255,0.62)',
  overlay: 'rgba(20,20,18,0.32)',
  text: {
    primary: '#141412',
    secondary: 'rgba(20,20,18,0.64)',
    tertiary: 'rgba(20,20,18,0.40)',
    onAccent: '#FBFAF7',
  },
  accent: {
    ink: '#141412',      // the only "brand" action colour
    graphite: '#4E4D48',
    silver: '#8A8880',
    mist: '#C6C4BC',
    paper: '#FFFFFF',
  },
  semantic: { success: '#3F7A5C', warning: '#8F6A2B', danger: '#A8473A' },
} as const;

export const gradient = {
  ink: ['#141412', '#6E6C65'],
  graphite: ['#4E4D48', '#A5A39B'],
  silver: ['#D8D6CE', '#F6F5F1'],
  paper: ['#FFFFFF', '#E9E7E0'],
} as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 14: 56 } as const;

export const radius = {
  xs: 8, sm: 12, md: 16, lg: 24, xl: 32, pill: 999,
} as const;

export const blur = { subtle: 20, glass: 40, heavy: 70 } as const;

export const z = { canvas: 0, hud: 10, chrome: 20, sheet: 30, overlay: 40, toast: 50 } as const;
```

### 2.1 Typography (all free Google Fonts via `@expo-google-fonts/*`)

| Role | Font | Size / line | Notes |
|---|---|---|---|
| display | Space Grotesk 700 | 34 / 38 | letterSpacing -0.5, hero titles only |
| title | Space Grotesk 600 | 22 / 28 | screen + sheet titles |
| headline | Inter 600 | 17 / 24 | list titles, buttons |
| body | Inter 400 | 15 / 22 | |
| caption | Inter 500 | 12 / 16 | letterSpacing 0.2, labels |
| mono | JetBrains Mono 500 | 12 / 16 | **all numeric HUD values** (tabular — no jitter while values change) |

**Arabic explainer copy (R2.9/R2.11).** The three Latin brand faces contain no Arabic glyphs. Arabic paragraphs therefore omit `fontFamily` and use the platform's Arabic face (Noto Naskh Arabic on Android, SF Arabic on iOS); they take only size / line-height from `type.*` and never `letterSpacing` (which can break Arabic joining). `src/lab/components/ArabicGuide.tsx` is the standard collapsed-by-default surface for these explanations. `src/lab/arabicExplain.ts` holds one short, child-level idea per registered filter; `ArabicOperationGuide` shows it in every Explain sheet, and Trace adds an **عربي** tab beside Maths/Code. The Convolution screen keeps the richer six-beat story.

### 2.2 Surfaces and depth

Depth is made from **hairline ink strokes + paper layering + one blurred glass layer**, not drop shadows (Android shadows are inconsistent) and not colour glow.

| Level | Use | Recipe |
|---|---|---|
| L0 | Photo canvas | Full-bleed Skia canvas; the only surface allowed to be ink-black (visualizer backdrop) |
| L1 | Chrome (top bar, carousel dock, tab bar) | `glass` fill + 1 px `stroke` + optional `BlurView` intensity ≈ `blur.subtle` |
| L2 | Sheets, param panel | `bg.1` paper + 1 px `stroke` |
| L3 | Pills, toasts, HUD chips | `bg.2` + 1 px `strokeStrong`; active state swaps to `accent.ink` ink/paper inversion |

**Android blur fallback:** if blur is unsupported or the device misses the frame budget, use `bg.1` at 92 % opacity. Never ship a blur that drops frames. Limit to **≤ 2 BlurViews on screen**.

### 2.3 Iconography

`lucide-react-native` (MIT), stroke width **1.75**, sizes 20/24. Icons that change meaning (play↔pause, plus↔close, download↔check) are **Skia path morphs**, not swaps.

---

## 3. Motion system

### 3.1 Presets (the only values components may use)

```ts
// src/core/motion.ts
import { Easing } from 'react-native-reanimated';

export const spring = {
  snappy: { damping: 18, stiffness: 320, mass: 0.8 },  // press-in, toggles
  smooth: { damping: 22, stiffness: 180, mass: 1 },    // layout, container transform
  gooey:  { damping: 10, stiffness: 140, mass: 0.9 },  // press-out, blobs, overshoot
  heavy:  { damping: 26, stiffness: 120, mass: 1.4 },  // large surfaces, sheets full-screen
  sheet:  { damping: 28, stiffness: 260, mass: 1 },
} as const;

export const duration = { instant: 90, fast: 160, base: 260, slow: 420, morph: 560, hero: 900 } as const;

export const ease = {
  emphasized: Easing.bezier(0.2, 0.8, 0.2, 1),   // entering / revealing
  accelerate: Easing.bezier(0.3, 0.0, 0.8, 0.15),// leaving
  standard:   Easing.bezier(0.4, 0.0, 0.2, 1),
} as const;

export const stagger = { list: 40, chips: 28, hud: 60 } as const; // ms between siblings
```

### 3.2 Rules

- **Springs for anything the finger touches or that changes shape. Timing for color, opacity, shader progress.**
- **Velocity hand-off:** when a gesture ends, pass `velocity` into `withSpring`/`withDecay`. No gesture ends with a dead stop.
- **Overshoot budget:** `gooey` for small elements (≤ 80 pt) only. Large surfaces use `smooth`/`heavy`.
- **Morph budget:** max **1 hero morph + 2 supporting animations** at once. Everything else holds still.
- **Interruptible:** every animation can be re-targeted mid-flight. Never lock input during a transition.
- **Crossfade rule for container transforms:** content A fades out in the first 35 % of progress, content B fades in from 45 %. Never both fully visible.
- **Idle loops** (aurora flow, blobs drifting) run only while the screen is focused and the app is active; cap to 30 fps on low-end devices.
- **Reduced motion:** see §9.

### 3.3 Standard choreography — "The Drop" (applying a filter)

This is the signature interaction and the first thing to polish.

| t (ms) | Event |
|---|---|
| 0 | Chip press-in (scale .96, radius ↑), light haptic |
| 0–120 | Chip morphs to the active pill, neighbours spring apart |
| 60 | Origin point is set (chip center projected onto the canvas, or the finger position if the user drags on the image) |
| 60–760 | Transition shader progress 0 → 1 (`ease.emphasized`): previous look → new look, spreading from the origin |
| 160–900 | Filter's **visualizer overlay** plays (ripple rings, scan bars, swirl trails…) |
| 400–800 | HUD histogram morphs from old to new curve (spring `smooth`) |
| 760 | Medium haptic on settle; if the filter is `animated`, its idle loop begins |

---

## 4. Morph primitives (build these first, reuse everywhere)

| Primitive | Behaviour | Tech |
|---|---|---|
| `MorphPressable` | Press: scale 1→.96 and radius ↑ (spring snappy). Release: spring gooey back. Light haptic. | Reanimated |
| `MorphSurface` | Glass panel L1–L3 with blur fallback and hairline top-lit stroke | expo-blur + Skia gradient stroke |
| `useContainerTransform` / `MorphContainer` | A trigger (button/card) expands into a full panel/screen and collapses back into the *same* rect | `measureInWindow` + animated rect/radius |
| `GooBlobs` | N circles that merge and split; used for the "new" button, empty states, palette, loaders | Skia blur + ColorMatrix |
| `MorphIcon` | Path interpolation between two icons | Skia `interpolatePath` |
| `MorphChip` | Operation pill: label-sized, 40 high, idle paper + hairline → active ink fill with paper text → editing (expands into param sheet) | Reanimated + container transform |
| `MorphSlider` | Thumb stretches with velocity (scaleX up to 1.6, scaleY compensates), track fills with a liquid gradient, value is a **SharedValue** | Gesture Handler + Reanimated |
| `MorphSwitch` | Thumb stretches while moving; track color interpolates | Reanimated |
| `MorphTabBar` | Liquid indicator: a blob that stretches toward the destination tab then snaps | Skia goo + Reanimated |
| `MorphSheet` | Bottom sheet; top radius 32→0 at full height; handle morphs line→chevron | Gesture Handler + Reanimated |
| `MorphToast` | Dynamic-island pill: small → expanded → small, content crossfades | Reanimated |
| `MorphNumber` | Digits roll vertically; mono font | Reanimated |
| `MorphProgress` | Ring whose trim end animates; on done, ring morphs into a check path | Skia `Path` `end` + `interpolatePath` |
| `MorphSkeleton` | Shimmer via moving gradient (no layout shift) | Skia/Reanimated |

Every primitive ships with: pressed / disabled / focused states, `accessibilityRole`, `accessibilityLabel`, a reduced-motion variant, and uses tokens only.

---

## 5. Visualization language (the product's heart)

The goal: **the user should *see* the filter happening to their photo and *see* the numbers behind it.** There are three layers:

### 5.1 Apply transitions (how a new look replaces the old one)

| id | Look | Used by |
|---|---|---|
| `radial-goo` | Circle grows from origin with a wobbling, gooey edge | most filters (default) |
| `liquid-wipe` | Noise-warped wipe left→right with a bright seam | Liquid, Aurora |
| `scan-bars` | Horizontal bars slide in with RGB offset | Glitch, Cyber Neon |
| `noise-dissolve` | Pixels dissolve through animated noise | Film Grain, Sketch |
| `swirl` | Image twists into the new look and untwists | Vortex, Kaleidoscope |

All share one transition-shader contract (see `architecture.md` §6.3). Easing is always `ease.emphasized`, 600–800 ms.

### 5.2 Visualizer overlays (signature effect drawn on the photo while the filter applies)

Drawn in the **same Skia canvas** as the photo (one GPU pass). Accent tones come from the filter's monochrome ramp (ink → graphite → silver → paper).

| id | Visual | Notes |
|---|---|---|
| `goo-burst` | Blobs erupt from the origin, merge, fade | Default for color filters |
| `ripple-rings` | 3 expanding rings with decaying opacity | Liquid, Prism |
| `scan-bars` | Thin luminous bars sweeping top→bottom with chromatic edge | Glitch |
| `swirl-trails` | Particle trails spiralling toward the origin | Vortex |
| `pixel-cascade` | Pixel grid with cells flipping to the new color | Pixel Morph |
| `grain-flicker` | Subtle film-grain flicker + light leak | Film |
| `edge-trace` | Neon line drawn along detected edges then filled | Neon, Sketch |
| `bloom-pulse` | Soft radial light that pulses once | Dream, Vignette |

Particle budget: **≤ 120 particles**, drawn as Skia primitives from a `useDerivedValue` — never as React views.

### 5.3 Data visualizations (HUD, always reflect what the pixels are doing)

| Viz | Behaviour |
|---|---|
| **Live histogram** | 64 bins, smoothed, drawn as one gradient-filled path; R/G/B as additive layers + luma stroke. Before/after curves morph via `interpolatePath` (same point count always). Recomputed from a 96-px thumbnail ~150 ms after the user stops changing a value. |
| **Palette blobs** | 5 dominant colors (k-means on a 32×32 sample) as goo blobs that drift on Lissajous curves; on filter change they cross-morph to the new colors |
| **Hue ring** | Ring showing hue distribution before/after; color filters visibly rotate the arcs |
| **Intensity dial** | Ring gauge with path trim + rolling mono number |
| **Liquid compare seam** | Before/after split. The divider is a wavy path whose amplitude follows drag velocity then settles flat; the handle morphs circle ↔ pill with speed |

HUD elements sit at L3 and collapse into a single pill when the user touches the image (so the photo is unobstructed).

**Week 3 implementation note.** Histogram Surgery uses the shared 64-bin analysis and 150 ms debounce, but its first-cut seam is a straight paper divider with a circular handle rather than the velocity-wavy path above; the wave is a later polish pass so the comparison is exact and the gesture stays cheap. Equalize/CLAHE/stretch plus the five-point tone curve are live; before/after histograms share one canvas, and the curve's 256-entry LUT runs through the new `applyLut` engine pass.

**Home hero.** The first screen is a live visual, not a wordmark on a blank page: `PixelSweepHero` magnifies 16×16 pixels of the synthetic scene with nearest-neighbour sampling and dissolves them into the smooth image while a 4×4 kernel window walks the grid. One shared value drives it, so it never touches React state, and it needs no photo (the Home is photo-independent). The Lab hub reuses the same hero and numbers its tiles 01–04 in mono.

**Home (2026-10-21).** The Home shows exactly two things, centred: **Edit a photo** (the editor — the only way to edit an image) and **Lab mode**. No counters, no session grid, no gallery, no Creative card: the first screen says in one glance what the app can do. The Primitives gallery and the Frequency Playground were removed on the owner's request.

**Creative mode (removed).** The dock, the hero canvas and the 96 px HUD histogram ship; "The Drop" is a 560 ms crossfade between the previous and the new look (both drawn as Skia layers, the HUD histogram crossfading with them) instead of the five SkSL transition shaders with a finger-driven origin. The six launch filters are engine operations for now, so the chrome stays monochrome and the photo carries the effect. The visualizer overlays, the palette blobs and the hue ring are still open (W3.9–W3.11).

### 5.4 Trace — the algorithm, performed on *this* photo

The signature explanation surface (owner directive: "not a separate example image"). Opening Trace for an operation stages its real pipeline on the user's proxy pixels:

| Element | Rule |
|---|---|
| Stages | Real engine outputs only (`src/lab/stages.ts`); the final stage is byte-identical to the registered operation result. Intermediate stages are the actual low-pass / detail / gradient maps, never re-drawn approximations. |
| Transition | Crossfade driven by **one** shared stage position: `opacityᵢ = clamp(1 − |pos − i|, 0, 1)`. The playhead owns the position; the photo morphs continuously while it is dragged. No React state inside the fade. |
| Playhead (R2) | `PhaseScrubber`: drag anywhere on the rail to morph the real stages, no snapping on release (park between stages to compare). **Original / Result** jump to the ends; stage-value chips jump to a specific stage. Autoplay is **opt-in** (header play button, default paused, `labMotion.stageHold` per stage); touching the playhead pauses it. Reduced motion disables autoplay and shortens programmatic fades. |
| Photo (R2) | A `PhotoChooser` lives inside every theatre: thumb + provenance trigger opens a sheet of all session photos plus "Import from library". The screen owns the selection and rebuilds on change; Trace never silently borrows a different photo. |
| Parameter (R2) | One primary registry parameter per operation (`TRACE_CONTROLS`): sharpen amount, gaussian σ, mean/median/adaptive window, bilateral range σ, noise strength/rate, Canny σ, CLAHE clip. Values snap to the registry min/step (`traceControlValue`), so window sizes stay odd. A commit rebuilds every stage and **parks on the final result**, making the change visible. |
| Maths (R2) | Bottom card, Maths tab: registry formula; the **probe pixel that changed most** (crosshair on the photo); a Skia plot of its grey level across every stage with a cursor tied to the playhead; live readout and tappable stage values; merged parameter line. |
| Code (R2) | Bottom card, Code tab: a typewriter reveal of a real engine excerpt (`src/lab/codeExcerpts.ts`), with Replay. Every traceable op must have one — enforced by tests. |
| Arabic (R2.11) | Bottom card, **عربي** tab: the operation-specific idea from `arabicExplain.ts` — one sentence, two or three concrete beats, and a try-this line. It explains the filter on the same photo, not a generic symbol glossary. |
| Ground | The photo window sits on an ink base so white edge/NMS maps stay legible inside the light UI; every other surface stays paper. |
| Text | Stage title + one-sentence note containing the live values (σ, k, amount), kept above the photo. The old static formula card is now the Maths tab, so the screen fits without scrolling. |

Trace is reachable from the editor ("See the maths · on this photo") and from the Denoise Arena ("Trace winner"). Any future operation earns a Trace entry by adding a builder to `stages.ts` — not by hard-coding a demo in UI. The bottom **Maths / Code / عربي** card replaces the removed user-facing operation log (owner R2; Arabic tab R2.11).

---

## 6. Screens

### 6.1 Home
- Wordmark with slow animated aurora gradient (Skia shader).
- A **goo "New" button** that breathes (blob scale ±4 %, 4 s loop). Tap → the button morphs into the image-source sheet (camera roll / camera).
- Recent edits in a staggered masonry grid. Each card: photo with its recipe applied, a small accent dot for the filter used. Tap → card **container-transforms** into the editor canvas.
- Empty state: three living goo blobs + one line of copy.

### 6.2 Editor (the main screen)

```
┌────────────────────────────────────┐
│ ◀ (morph)               Export ◉   │  L1 top bar — shrinks to icons on touch
│                                    │
│          S K I A   C A N V A S     │  L0 photo + filter + visualizer
│          pinch / pan / long-press  │
│                                    │
│   ┌ HUD: histogram · palette ┐     │  L3 — collapses to a pill on touch
│                                    │
│   ◐ intensity  ═══●════════        │  MorphSlider
│ ┌────┐┌────┐┌────┐┌────┐┌────┐ →   │  L1 filter dock (MorphChips)
│ │    ││    ││    ││    ││    │     │
│ └────┘└────┘└────┘└────┘└────┘     │
│   ⌂      ◧      ✦      ⤓           │  MorphTabBar: Filters · Adjust · Compare · Export
└────────────────────────────────────┘
```

Gestures on the canvas:
- **Tap + drag** → moves the effect origin (finger-controlled center for Vortex, Liquid, Prism…) with spring lag.
- **Pinch / pan** → zoom and move the photo (transform lives in a Skia matrix from shared values).
- **Long-press** → shows the original (liquid seam sweeps away); release → back.
- **Two-finger tap** → undo.

Below the ops row, **"See the maths · on this photo"** lists the explainable operations (Sharpen, Denoise, Median, Noise, Edges, Canny, Equalise, Grayscale, Invert, Sepia, Posterize). Each pill opens `/explain/[op]` with this photo id and the same params — see §5.4.

Editing flow: tapping an *active* chip **container-transforms** it into the parameter sheet (chip rect → sheet rect). Closing collapses the sheet back into the chip.

### 6.3 Export (modal sheet)
Preview, format (JPG/PNG), quality slider. "Save" button morphs into a progress ring, then the ring morphs into a check while a goo-burst celebrates. Share button appears by splitting from the Save blob.

### 6.4 Trace (route `/explain/[op]`)
Full-height, chrome-less except a hairline progress rule, back/pause buttons and a paper stage card:

```
┌────────────────────────────────────┐
│ ◀   Unsharp mask              ▶    │  play is opt-in
│     [thumb] Photo · 512×512 ▾      │  in-widget photo chooser
│        ┌──────────────────┐        │  ink photo window
│        │  stage image  +  │        │  crossfade pos drives opacity
│        │   probe cross    │        │  white probe mark
│        └──────────────────┘        │
│  02 / 04  Detail layer   Orig. Res.│  counter + jumps
│  in − blur isolates edges …        │
│  ◀────────●──────────────────────▶ │  manual playhead (drag)
│  Sharpening 1.2   ═══●════════     │  primary registry control
│  ┌ Maths | Code | عربي ───────────┐ │
│  │ out = in + amount·(in − blur) │ │  formula (Maths)
│  │ ╱╲___╱╲__  ● grey 172.4 /255  │ │  probe plot + cursor
│  │ 01·138  02·128  03·172        │ │  tappable stage values
│  └───────────────────────────────┘ │
└────────────────────────────────────┘
```

---

## 7. Filter signatures (v1 catalog — 14 filters)

| Filter | Category | Look | Transition | Visualizer | Accent ramp |
|---|---|---|---|---|---|
| Aurora | color | Animated silver ramp flowing across luma | liquid-wipe | goo-burst | ink→silver |
| Duotone | color | Two-tone map, adjustable ink/paper endpoints | radial-goo | goo-burst | graphite→paper |
| Thermal | color | Luma → stepped tonal ramp | radial-goo | bloom-pulse | silver |
| Neon | color | Edge glow on darkened image | scan-bars | edge-trace | silver→paper |
| Liquid | distort | Ripple waves from the touch point | liquid-wipe | ripple-rings | silver→ink |
| Vortex | distort | Swirl around the touch point | swirl | swirl-trails | graphite→ink |
| Glitch | distort | Tonal channel split + slice displacement | scan-bars | scan-bars | graphite→silver |
| Prism | distort | Radial tonal dispersion | radial-goo | ripple-rings | silver→graphite |
| Pixel Morph | distort | Pixelation that animates cell size | noise-dissolve | pixel-cascade | mist→silver |
| Film | light | Grain, fade, tonal cast | noise-dissolve | grain-flicker | silver |
| Dream | light | Soft bloom / halation | radial-goo | bloom-pulse | ink→mist |
| Noir | light | High-contrast B&W + vignette | radial-goo | bloom-pulse | paper→graphite |
| Halftone | style | Dot-screen print | noise-dissolve | pixel-cascade | graphite→paper |
| Sketch | style | Edge-line drawing on paper tone | noise-dissolve | edge-trace | paper |
| Kaleidoscope | style | Mirrored wedges | swirl | swirl-trails | ink→paper |

Every ramp is monochrome (owner directive 2026-10-20) — the photo, not the chrome or the effect signature, carries hue. Colour-led names kept for continuity will be re-themed when Week 3 builds the catalog; any filter that still produces colour must justify it as an image effect (e.g. Duotone on a colour photo), never as UI chrome.

(Ship 6 first: Aurora, Liquid, Vortex, Glitch, Duotone, Noir. Add the rest in phase 5.)

---

## 8. Haptics map (`expo-haptics`)

| Event | Feedback |
|---|---|
| Press-in on any MorphPressable | impact Light |
| Filter applied (transition settles) | impact Medium |
| Slider crosses 0 / 0.5 / 1 | selection |
| Slider at min/max hard stop | impact Rigid |
| Export success | notification Success |
| Error | notification Error |

Haptics respect the OS setting and are skipped under reduced motion if the user also disabled them in app settings.

---

## 9. Accessibility

- **Reduce Motion** (`useReducedMotion` from Reanimated): replace morphs with 150 ms crossfades; disable idle loops, particles and goo; shader transitions become a simple opacity blend.
- Contrast: text on glass ≥ 4.5:1 (check against the brightest photo, add a scrim if needed).
- Touch targets ≥ 44×44 pt even when the visual is smaller (`hitSlop`).
- Every interactive element: `accessibilityRole`, `accessibilityLabel`, `accessibilityState`.
- Never encode information in color alone — the active filter also gets a label + ring.
- Gestures on canvas have button equivalents (compare, undo, reset origin).

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| Animate transform, opacity, color, borderRadius, Skia uniforms | Animate `width/height/margin` via React state |
| Use shared values and derived values | `setState` inside gesture/animation frames |
| Stretch + squash with velocity | Linear or `ease-in-out` for touch responses |
| One hero morph per interaction | Everything moving at once |
| Let the photo's colors lead | Neon UI chrome competing with the photo |
| Keep chrome ink / graphite / silver / paper | Introduce a second accent hue (violet, cyan, lime…) |
| Fall back gracefully (no blur, no goo) | Ship effects that drop below 55 fps on mid-range Android |
| Tokens from `tokens.ts` / `motion.ts` | Magic numbers and ad-hoc springs |

---

## 11. Acceptance checklist for any component

- [ ] Uses only tokens and motion presets
- [ ] Every state exists: idle · pressed · focused · disabled · loading · error
- [ ] Has an *origin* and a *destination* for every appearance/disappearance
- [ ] Animations are UI-thread; no per-frame React renders (verify with the perf monitor)
- [ ] Gesture end passes velocity into the spring
- [ ] Reduced-motion variant exists
- [ ] Accessible labels and ≥ 44 pt targets
- [ ] Works on a mid-range Android at ≥ 55 fps
