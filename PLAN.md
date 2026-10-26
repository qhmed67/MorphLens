# PLAN.md — MorphLens build plan (approved work order)

> Read with `docs/AGENTS.md`, `docs/architecture.md` (esp. §18), `docs/design.md`, `docs/SKILL.md`.
> Status: **ACTIVE — Week 1 gate passed (2026-10-20); Week 2 + design revisions R and R2 code complete, device verification pending** (2026-10-20). `tsc`, ESLint, Jest (237 tests / 21 suites, 97.24 % statements / 89.16 % branches / 99.39 % funcs / 98.69 % lines overall; `src/engine` 97.87 / 96.42 / 100 / 99.2), Android export and `expo-doctor` (20/20) pass. W2.1–W2.15 landed: engine algorithms, banded execution policy, Lab screens 1 & 2 (`/lab/convolution`, `/lab/denoise`). R1–R4 landed: light monochrome palette + Trace (`/explain/[op]`) replaying real operation stages on the user's photo. R2.1–R2.7 landed: compact pill chips, in-theatre photo choice, manual playhead, adjustable primary parameter with result-on-commit, maths motion-graphics + typewriter code panel, log-free shorter chrome. R2.9 landed: compact Home mode rows and an Arabic convolution guide. R2.10 landed: convolution default fixed to spatial identity, empty weight fields no longer zero the kernel, border modes are explanatory selectable cards, and the Arabic guide is a shorter worked 3×3 example. R2.11 landed: Denoise Arena is responsive and never blank, and every operation has a short Arabic concept in Trace/Explain. W3.1–W3.5, W3.7, W3.8 and W3.12 landed and were then trimmed by the owner (2026-10-21): the app now has **two doors** — Home → *Edit a photo* (editor) and Home → *Lab mode* (Convolution, Denoise, Histogram, Enhance). The Frequency Playground and Creative mode were removed at the owner's request; the six creative filters stay in the engine as documented algorithms. Owner fix pass R2.12 landed: before/after sides were swapped, a press overlay stained the Denoise cards, the arena proxy was too small to look denoised, and Enhance Studio blurred instead of denoising. Owner device pass needed for fps/DoD, Trace feel + ★ review checkpoint, and the new screens' touch feel.
> Scope of this file: verification, algorithm catalogue, Lab screen specs, task breakdown, tests, risks, spikes, demo script, open questions.
> Reference date: **2026-10-20**. Target first review ≈ **2026-11-15**.

Legend: cost `L` light (per-pixel / O(N)) · `M` medium · `H` heavy (must run off the UI path).
SkSL column: `Y` = light op also exists as a live SkSL shader (reference-vs-shader parity test required).

---

## 1. Verified tech decisions

### 1.1 Verified against the npm registry / official docs (2026-10-20)

`npx expo install` resolves versions from Expo's **bundledNativeModules** for the SDK, not npm `latest`. Pinned set for **Expo SDK 58** (expo `58.0.16`):

| Package | Version `expo install` picks | Source |
|---|---|---|
| `expo` | 58.0.16 (`latest`) | npm dist-tag |
| `react` | 19.3.0 | bundled |
| `react-native` | 0.88.0 | bundled |
| `expo-router` | ~58.0.24 | bundled |
| `react-native-reanimated` | 4.7.1 | bundled |
| `react-native-worklets` | 0.13.0 | bundled |
| `react-native-gesture-handler` | ~3.3.0 | bundled |
| `@shopify/react-native-skia` | 2.14.0 | bundled |
| `@react-native-async-storage/async-storage` | 2.2.0 | bundled (**not** npm latest 3.1.1) |
| `react-native-svg` | 15.16.0 | bundled |
| `react-native-safe-area-context` | ~5.10.1 | bundled |
| `react-native-screens` | ~4.30.0 | bundled |
| `expo-image-picker` | ~58.0.10 | bundled |
| `expo-image-manipulator` | ~58.0.15 | bundled |
| `expo-file-system` | ~58.0.10 | bundled |
| `expo-media-library` | ~58.0.11 | bundled |
| `expo-sharing` | ~58.0.19 | bundled |
| `expo-haptics` | ~58.0.7 | bundled |
| `expo-blur` | ~58.0.5 | bundled |
| `expo-font` | ~58.0.9 | bundled |
| `expo-linear-gradient` | ~58.0.3 | bundled |
| `expo-constants` / `expo-linking` | bundled (router peers) | `expo-doctor` |
| `jest-expo` | ~58.0.11 | bundled |
| `eslint-config-expo` | ~58.0.4 | bundled |
| `@testing-library/react-native` | 14.1.0 | npm `latest` (dev) |

Not in the Expo map — install with plain `npm i` (all MIT/ISC/OFL, free-only rule satisfied):
`zustand@^5.0.15`, `lucide-react-native@^1.59.0`, `@expo-google-fonts/space-grotesk@^0.4.1`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`, `prettier`, `typescript` (Expo default).

**Scaffold command (Phase 0, later — not run now):**
```
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router react-native-reanimated react-native-worklets \
  react-native-gesture-handler @shopify/react-native-skia expo-image-picker \
  expo-image-manipulator expo-file-system expo-media-library expo-sharing \
  expo-haptics expo-blur expo-font expo-splash-screen expo-status-bar \
  expo-system-ui react-native-safe-area-context react-native-screens \
  react-native-svg @react-native-async-storage/async-storage
npm i zustand lucide-react-native @expo-google-fonts/space-grotesk @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
npx expo install --dev jest-expo @testing-library/react-native eslint-config-expo prettier
```

### 1.2 Config set-up (Phase 0)

- `babel.config.js` — **not needed in SDK 58**: `babel-preset-expo` auto-injects the worklets transform (verified by `__workletHash` in the exported Android bundle). If ever added manually, `react-native-worklets/plugin` must be last.
- `tsconfig.json` — `"strict": true`, `"types": ["jest"]`, `"paths": { "@/*": ["./src/*"] }` (no `baseUrl`: TS 6 deprecates it), `extends: "expo/tsconfig.base"`.
- `jest` — preset `jest-expo`; `moduleNameMapper` for `@/*`; tests in `__tests__/engine`; coverage thresholds 85 % on statements/branches/functions/lines over `src/engine/**` (bridge excluded).
- `app.json` — **no explicit `newArchEnabled` / `android.edgeToEdgeEnabled`** (SDK 58 schema rejects both; they are the defaults), `"scheme": "morphlens"`, plugins for `expo-router`, `expo-image-picker`, `expo-media-library`.
- `.gitignore` — `node_modules`, `.expo`, `dist`, `ios/`, `android/`, `coverage`, `.env*` (AGENTS §Git policy).
- `eslint.config.js` — `eslint-config-expo/flat`; rules banning `react-native` `Animated` and `useAnimatedGestureHandler` (SKILL §9). **Prettier** for formatting.

### 1.3 Corrections to the spec files (do **not** edit specs yet — list only)

| # | Spec location | Problem | Correction (for installed versions) |
|---|---|---|---|
| C1 | arch §18.2 rule 6, §2 | `runOnRuntime` is **deprecated in worklets 0.13** ("will be removed in the next major"). | Use `scheduleOnRuntime(rt, worklet, ...args)` (async) or `runOnRuntimeSync(rt, worklet, ...args)`. |
| C2 | arch §18.2 rule 6 | `createWorkletRuntime` now takes a **config object**, not just a name string. | `createWorkletRuntime({ name: 'engine', enableEventLoop: true, enableLocking: true })`. |
| C3 | arch §2 / §18.7, SKILL §1 rule 9 | `runOnJS`/`runOnUI` from Reanimated 4.7.1 are **`@deprecated`** (JSDoc points to worklets). | `src/core/threads.ts` re-exports `scheduleOnRN` / `scheduleOnUI` from `react-native-worklets`; keep thin `runOnJS`/`runOnUI` aliases for spec compatibility and mark them deprecated locally. |
| C4 | arch §8.1, §18.2 rule 7 | `Skia.Surface.MakeOffscreen` is **GPU-backed**; `readPixels` then stalls on GPU→CPU readback. | Use CPU raster surface **`Skia.Surface.Make(w, h)`** for analysis readback and for any pixel round-trip; reserve `MakeOffscreen` for export quality only (`Skia.Surface.Make(w,h)` returns `SkSurface \| null`). |
| C5 | arch §18.2 rule 7 | `Skia.Data.fromBytes(bytes: Uint8Array)` — `ImageBuffer.data` is `Uint8ClampedArray`, which is **not** a `Uint8Array` for TS. | Either type `ImageBuffer.data` as `Uint8Array` and clamp manually, or wrap with `new Uint8Array(data.buffer)`. `Skia.Image.MakeImage(info, data, w*4)` exists in 2.14 and **copies** the pixels. Use `ImageInfo = { width, height, alphaType: Skia.AlphaType.Unpremul, colorType: Skia.ColorType.RGBA_8888 }`. |
| C6 | arch §9.1 | `ImageManipulator.manipulateAsync` is **`@deprecated`** in expo-image-manipulator 58. | Use the contextual API: `ImageManipulator.manipulate(uri).resize({ width }).renderAsync()` (or `useImageManipulator`). Chain `.rotate()` for EXIF, then `.saveAsync({ compress, format })`. |
| C7 | arch §5.2, §9.1, §9.3 | `expo-file-system` SDK 58 defaults to the **new `File`/`Directory`/`Paths` API**; `documentDirectory` + `writeAsStringAsync` are legacy. | Import `{ File, Directory, Paths }` from `expo-file-system`. Legacy symbols live in `expo-file-system/legacy`. Rewrite `library/files.ts` + export with `new File(Paths.document, ...)`, `file.write(bytes)`, `file.base64()`. |
| C8 | arch §3, §18.4 | Folder tree in §3 lacks `src/engine/**` and `src/lab/**` added by §18. | Add both (and `src/engine/bridge/skia.ts`) to the tree; `Recipe` gains optional `ops: { id, args }[]`. |
| C9 | arch §6.3, §6.4, SKILL §5.5 | Nested child `Shader`s (`from`/`to`) are **supported** but each child is a full pass; a transition = 2 filtered passes + transition pass per pixel. | Keep it, but cap preview long edge at 512 px during Lab interactive ops and 1080 px in Creative; measure in Spike (a). At rest collapse to a single pass (already in §6.4). |
| C10 | SKILL §5.2 | `triggerRef.current?.measureInWindow(...)` JS callback API still works on RN views, but Reanimated 4 prefers `measure(animatedRef)` in a worklet. | Keep the JS `measureInWindow` (simplest, matches SKILL) but the root overlay host must be a sibling at the root so coordinates match — verify in Spike (e). |
| C11 | arch §8.1 | `SkImage.readPixels` in 2.14 can return `Uint8Array | Float32Array | null` and blocks on texture-backed images. | Prefer CPU surface snapshot then `readPixels()`; guard `null`; convert to a fresh `Uint8Array`. |
| C12 | SKILL §1 rule 6 / §9 | `useAnimatedGestureHandler` is gone in v4 — spec already says so; add a lint rule so it cannot reappear. | ESLint `no-restricted-imports`/`no-restricted-syntax`. |
| C13 | SKILL §0/§1 rule 1, arch §2 | Spec asks for a `babel.config.js` containing the worklets plugin. In SDK 58 `babel-preset-expo` already injects it. | **Do not add** `babel.config.js`; verified `__workletHash` appears in the exported HBC. Adding the plugin twice would be a no-op at best. |
| C14 | arch §2 / §18.6 | SDK 58 Expo config schema rejects explicit `newArchEnabled` and `android.edgeToEdgeEnabled`. | Omit both keys (New Architecture and edge-to-edge are the defaults in RN 0.88). `expo-doctor` requires `expo-constants` + `expo-linking` as direct peers of `expo-router`; installed. |
| C15 | build perf | `@expo-google-fonts/*` package indexes re-export **all** weights, so a named import bundles ~40 TTFs (first export: ~3.5 MB extra). | Import per-weight subpaths (`@expo-google-fonts/inter/400Regular`). Export now contains only the six used fonts. |

### 1.4 Free / Expo-Go compliance notes

- `@shopify/react-native-skia`, Reanimated 4 + Worklets, Gesture Handler 3, `expo-blur`, `expo-haptics` are all **in Expo Go** for SDK 58 → no dev build for v1.
- New Architecture is mandatory (Reanimated 4). Expo Go SDK 58 runs New Arch.
- No Shadertoy copy-paste; all SkSL in-house (arch §15).
- Worker runtimes have **no Skia** — engine output crosses runtimes as plain typed arrays; the bridge must run on the RN/UI runtime.

---

## 2. Algorithm catalogue (`src/engine/**`)

Complexity: `N` = W·H · `k` = kernel size · `K` = separable taps · `L` = gray levels (256) · `T` = tiles · `P` = padded FFT size. All ops are pure, non-mutating, deterministic. `params` ranges follow `ParamDef` (arch §6.2). "Screen" = Lab screen that demonstrates it (see §3); a dash = used indirectly (Creative adjust / Enhance Studio / tests).

### 2.1 Colour — spaces, adjust, balance, transfer, effects

| Op (id) | Formula (one line) | Params (range, default) | Cost | Screen | SkSL | Tests (name → expected) |
|---|---|---|---|---|---|---|
| `rgb2hsv` / `hsv2rgb` | HSV cone round-trip | — | L | 5 | — | `hsv-roundtrip` → same ±1; `hsv-red-hue` → (255,0,0) ⇒ h=0,s=1,v=1 |
| `rgb2hsl` / `hsl2rgb` | HSL bi-cone round-trip | — | L | 5 | — | `hsl-roundtrip` → ±1; `hsl-white` → s=0,l=1 |
| `rgb2ycbcr` / `ycbcr2rgb` | BT.601 matrix | — | L | 5 | — | `ycbcr-roundtrip` → ±1; `ycbcr-gray` → Y=128,Cb=128,Cr=128 |
| `rgb2lab` / `lab2rgb` | sRGB→XYZ (D65)→Lab | — | L | 5, 9 | — | `lab-roundtrip` → ±2; `lab-white` → L≈100,a≈0,b≈0 |
| `brightness` | `out = clamp(in + b)` | b ∈ [−100,100], 0 | L | 8, Creative | **Y** | `brightness-mid` → 128,b=+50 ⇒ 178 |
| `contrast` | `out = (in−128)·c + 128` | c ∈ [0,3], 1 | L | 8, Creative | **Y** | `contrast-pivot` → 128,c=2 ⇒ 128; `contrast-up` → 160,c=2 ⇒ 192 |
| `gamma` | `out = 255·(in/255)^(1/γ)` | γ ∈ [0.2,5], 1 | L | 8 | **Y** | `gamma-two` → 64,γ=2 ⇒ 128 |
| `saturation` | `out = luma + s·(in−luma)`, luma=0.2126R+0.7152G+0.0722B | s ∈ [0,3], 1 | L | 5, Creative | **Y** | `sat-zero` → (255,0,0) ⇒ (54,54,54); `sat-gray-invariant` |
| `hueShift` | rotate hue by θ° in HSV | θ ∈ [−180,180], 0 | L | 5 | **Y** | `hue-120` → red ⇒ green (±2) |
| `grayscale` | `out = round(0.2126R+0.7152G+0.0722B)` | — | L | 8 | **Y** | `gray-red` → (255,0,0) ⇒ (54,54,54) |
| `sepia` | 3×3 sepia matrix + clamp | strength ∈ [0,1], 1 | L | — | **Y** | `sepia-white` → (255,255,239) |
| `invert` | `out = 255−in` | — | L | — | **Y** | `invert-black` → 0 ⇒ 255 |
| `channelMixer` | 3×3 RGB matrix | 9 coeffs ∈ [−2,2] | L | 5 | **Y** | `mixer-identity` ⇒ input |
| `duotone` | map luma to gradient(dark→light) | dark/light colours | L | — | **Y** | `duotone-extremes` → luma 0 ⇒ dark, 255 ⇒ light |
| `posterize` | `out = round(in/255·(L−1))/(L−1)·255` | levels ∈ [2,32], 6 | L | — | **Y** | `posterize-200` → L=2, in 200 ⇒ 255 |
| `grayWorldWB` | gains = meanGray / mean(ch) | strength ∈ [0,1], 1 | L | 8 | — | `grayworld-constant` ⇒ unchanged; `grayworld-known-means` ⇒ gains match |
| `whitePatchWB` | gains = 255 / max(ch) | strength ∈ [0,1], 1 | L | 8 | — | `whitepatch` ⇒ channel max 255 |
| `colorTransferReinhard` | match Lab mean/σ of source to reference | strength ∈ [0,1], 1 | M | 9 | — | `transfer-self` ⇒ identity ±2; `transfer-mean` ⇒ source mean ≈ ref mean |

### 2.2 Noise — generate, denoise, metrics

| Op (id) | Formula | Params | Cost | Screen | SkSL | Tests |
|---|---|---|---|---|---|---|
| `noiseGaussian` | `out = in + N(0,σ)` (seeded) | σ ∈ [0,50], 16; seed ∈ [0,2^31) | L | 2 | — | `gauss-seed-stable` → same seed ⇒ identical; `gauss-mean` → mean≈0 ±0.5 |
| `noiseSaltPepper` | each px → 0 or 255 w.p. p/2 | p ∈ [0,0.2], 0.02; seed | L | 2 | — | `sp-p0` ⇒ unchanged; `sp-count` → ≈ p·N ±0.5 % |
| `noiseSpeckle` | `out = in·(1+N(0,σ))` | σ ∈ [0,1], 0.1; seed | L | 2 | — | `speckle-zero` ⇒ unchanged |
| `meanFilter` | box k×k mean | k ∈ {3,5,7,9}, 3 | M | 2 | — | `mean-constant` ⇒ constant; `mean-impulse-spread` |
| `gaussianFilter` | separable gaussian(σ) | σ ∈ [0.5,5], 1.4; k auto | M | 2 | — | `gauss-constant` ⇒ constant; `gauss-separable ≡ 2D` ±1 |
| `medianFilter` | median of k×k window | k ∈ {3,5,7}, 3 | H (k≥5) | 2 | — | `median-salt` → 3×3 single 255 impulse removed; `median-checker-3x3` ⇒ known value |
| `adaptiveMedian` | grow window until median non-extreme | kMax ∈ {3..11}, 7 | H | 2 | — | `admed-heavy-salt` → recovers > plain median |
| `bilateralFilter` | spatial·range gaussian | σs ∈ [1,10]=2, σr ∈ [10,100]=30, radius ∝σs | H | 2 | — | `bilateral-constant` ⇒ constant; `bilateral-edge-preserved` ⇒ step retained |
| `mse` | `Σ(a−b)²/N` | — | L | 2 | — | `mse-identical` ⇒ 0 |
| `psnr` | `10·log10(255²/MSE)` | — | L | 2 | — | `psnr-identical` ⇒ guarded ∞; `psnr-mse1` ⇒ 48.13 dB |
| `ssim` | windowed luminance/contrast/structure | window 8 | M | 2 | — | `ssim-identical` ⇒ 1; `ssim-noisier-lower` monotonic (seed) |

### 2.3 Enhance — histogram, CLAHE, sharpen, stretch

| Op (id) | Formula | Params | Cost | Screen | SkSL | Tests |
|---|---|---|---|---|---|---|
| `histogram` | counts per bin (R,G,B,luma) | bins ∈ {32,64,128,256} | L | 3, HUD | — | `hist-const` → 8×8 of 128 ⇒ bin 128 = 64 |
| `cdf` | cumulative sum / N | — | L | 3 | — | `cdf-monotone`, `cdf-last` ⇒ 1 |
| `equalize` | `out = round(CDF(in)·255)` (luma or per-channel) | mode: luma/per-channel | L | 3 | — | `eq-cdf-linear` → output CDF ≈ linear (χ² small) |
| `histMatch` | match source CDF to reference CDF | reference buffer | M | 3 | — | `match-ramp` → output histogram ≈ reference |
| `clahe` | clip-limited tiles + bilinear interp | tiles ∈ {4,8,16}=8; clip ∈ [1,8]=3 | H | 3, 8 | — | `clahe-constant` ⇒ constant; `clahe-clip-bounds` |
| `unsharpMask` | `out = in + a·(in − blur)` | amount ∈ [0,3]=1, radius ∈ [0.5,5]=1.4 | M | 8, 6 | — | `unsharp-ramp` → edge overshoot sign correct |
| `laplacianSharpen` | `out = in + c·∇²in` | c ∈ [0,2]=1 | M | 8 | — | `lap-constant` ⇒ constant |
| `contrastStretch` | map [min,max]→[0,255] | mode: luma/per-channel | L | 3 | — | `stretch-100-200` → 150 ⇒ 127/128 |
| `autoLevels` | per-channel min/max stretch | — | L | 8 | — | `auto-levels-known` |

### 2.4 Spatial — convolve, kernels, edges, morphology

| Op (id) | Formula | Params | Cost | Screen | SkSL | Tests |
|---|---|---|---|---|---|---|
| `convolve` | `Σ wᵢ·patchᵢ` w/ border mode | kernel (k×k), border ∈ clamp/reflect/zero | M | 1 | — | `conv-identity` ⇒ input; `conv-constant-box` ⇒ constant; `conv-known-3x3` ⇒ hand value |
| `separableConvolve` | 1-D rows then cols | 1-D kernel | M | 1 | — | `sep-equals-2d` ±1 |
| `boxKernel` | all 1/k² | k | L | 1 | — | size/shape |
| `gaussianKernel` | `exp(−(x²+y²)/2σ²)` normalized | σ | L | 1 | — | sums to 1 ±1e−6 |
| `sobelKernel` / `prewittKernel` | derivative masks | axis | L | 1, 6 | — | known coefficients |
| `laplacianKernel` | 4/8-neighbour | variant | L | 1 | — | sums to 0 |
| `logKernel` | Laplacian-of-Gaussian | σ | M | 1 | — | zero-sum |
| `embossKernel` | directional | — | L | 1 | — | constant ⇒ mid-gray |
| `sobelEdges` | magnitude `√(Gx²+Gy²)`, direction `atan2` | threshold ∈ [0,255] | M | 6 | — | `sobel-vertical-step` → known magnitude; `sobel-flat` ⇒ 0 |
| `prewittEdges` | as Sobel, Prewitt masks | threshold | M | 6 | — | `prewitt-vertical-step` |
| `canny` | gauss→sobel→NMS→hysteresis | σ ∈ [0.5,3]=1.4, low ∈ [0,1]=0.1, high ∈ [0,1]=0.3 | H | 6 | — | `canny-flat` ⇒ 0 edges; `canny-step-one-line`; `canny-stages-match` |
| `erode` / `dilate` | min/max over structuring element | shape ∈ disk/square/cross, size ∈ [1,15] | M | 7 | — | `erode-5x5-plus`, `dilate-5x5-plus` |
| `open` / `close` | erode→dilate / dilate→erode | as above | M | 7 | — | `open-removes-specks`, `close-fills-holes` |
| `morphGradient` | `dilate − erode` | as above | M | 7 | — | `gradient-step` ⇒ edge band |
| `topHat` | `in − open(in)` | as above | M | 7 | — | `tophat-small-bright` |

### 2.5 Frequency — FFT and masks

| Op (id) | Formula | Params | Cost | Screen | SkSL | Tests |
|---|---|---|---|---|---|---|
| `fft1d` / `ifft1d` | radix-2 butterfly, constant-length | length (power of 2) | M | 4 | — | `fft-impulse` ⇒ flat; `fft-constant` ⇒ single bin; `fft-roundtrip` ε<1e−4 |
| `fft2d` / `ifft2d` | rows then cols | padded P×P | H | 4 | — | `fft2d-ifft2d` ε<1e−4; `fft2d-linear` matches DFT |
| `fftShift` | quadrant swap | — | L | 4 | — | `shift-involution` |
| `zeroPadPow2` | pad to next pow2 | — | L | 4 | — | `pad-next-pow2` |
| `spectrumMagnitude` | `log(1+√(Re²+Im²))` normalized | gain | L | 4 | — | `spectrum-dc-bright` |
| `idealLP`/`HP`/`BP` | keep inside/outside/annulus radius | cutoff, band | M | 4 | — | `ideal-lp-blurs`; `ideal-hp-edges` |
| `gaussianLP`/`HP` | gaussian roll-off in radius | cutoff | M | 4 | — | `gauss-lp-smooth` |
| `butterworthLP`/`HP` | `1/(1+(r/D)²ⁿ)` | cutoff, order n ∈ [1,6] | M | 4 | — | `butterworth-monotone` |

---

## 3. Lab-mode screen specs (Algorithm Theatre)

Shared rules: proxy ≤ **512 px** for interactive ops; `Skia.Surface.Make` (CPU) for readback (§1.3 C4/C11); heavy ops via the engine execution policy (§18.2 rule 6); each screen has an **Explain** `MorphSheet`; every theatre has an in-widget **PhotoChooser**. Owner revision R2 removed the user-facing operation log — the maths/code panel in Trace replaces it.

### 3.1 Convolution Explainer
```
┌───────────────┬───────────────────────┐
│ magnified 3×3 │ output grid grows     │
│ patch + kernel│ pixel-by-pixel        │
│  [w w w]      │  ▓▓▓▓░░░░             │
│  [w w w] ×    │  ▓▓▓░░░░░             │
│  [w w w]      │  ▓░░░░░░░             │
│  Σ → out px   │                       │
├───────────────┴───────────────────────┤
│ kernel presets: blur sharpen sobel …  │
│ speed ●──────   [Explain]             │
└───────────────────────────────────────┘
```
- **Signature:** glowing kernel window slides over a magnified patch; each term multiplies then sums on-screen; result pixel "pops" into the output grid.
- **Shared values:** `kPos` (0..1 along the sweep), `speed`, `kernel` (as `params`), `reveal` (0..1 output mask), `time`.
- **Engine calls:** `convolve(src512, kernel, border)`, incremental (compute row bands, `RunCtx.onProgress`).
- **Perf risk:** recomputing full conv per frame. **Mitigation:** precompute once → render `reveal` mask animating over the cached result; speed slider only changes the mask.
- **Fallback:** fixed-speed loop, no velocity scrub.

### 3.2 Denoise Arena
```
┌───────────────────────────────────────┐
│ noise: gaussian ▾   amount ●───       │
├──────────┬──────────┬───────────────┤
│ mean     │ gaussian │ median │ bilat │
│ PSNR 28.1│ 31.0     │ 34.2 ♛ │ 33.1  │
│ SSIM .71 │ .82      │ .91    │ .88   │
├──────────┴──────────┴───────────────┤
│ [difference heatmap] [Explain]        │
└───────────────────────────────────────┘
```
- **Signature:** 4 side-by-side cards + rolling `MorphNumber` PSNR/SSIM badges; crown morphs onto the winner; heatmap toggle (error → hot colours).
- **Shared values:** `noiseAmount`, `noiseType` (store), `heat` (0..1), `crown` (0..3), `time`.
- **Engine calls:** `noiseGaussian|SaltPepper|Speckle`, `mean|gaussian|median|bilateral`, `psnr`, `ssim` (8×8 windowed), diff buffer for heatmap.
- **Perf risk:** median/bilateral heavy on 4 cards. **Mitigation:** debounce 150 ms, run once per change, compute on 256 px proxy for metrics, show 512 px only for winner/focused card.
- **Fallback:** run 2 filters (mean+median) on low tier; hide heatmap.

### 3.3 Histogram Surgery
```
┌───────────────────────────────────────┐
│   ▁▂▃▅▆▇▆▅▃▂▁  histogram + CDF curve  │
├───────────────────────────────────────┤
│  (o) equalize  ( ) CLAHE  ( ) stretch │
│  ┌─ liquid seam before│after ─┐       │
│  │        photo             │        │
│  └───────────────────────────┘       │
│  curve editor: ───╱╲──  [Explain]     │
└───────────────────────────────────────┘
```
- **Signature:** live 64-bin histogram + CDF; equalization visibly flattens the histogram while the photo changes (`interpolatePath`); liquid seam compares equalize vs CLAHE vs stretch; draggable tone-mapping LUT.
- **Shared values:** `seamX`, `method` (store), `lut` (SharedValue number[] — fixed point count), `histCur`/`histPrev` paths, `time`.
- **Engine calls:** `histogram`, `cdf`, `equalize`, `clahe`, `contrastStretch`, `applyLut`; analysis at 96 px (§8.1).
- **Perf risk:** CLAHE + path morph per frame. **Mitigation:** analysis debounced 150 ms; paths fixed point count; CLAHE on 512 px once per change.
- **Fallback:** disable LUT drag; binary method switch with opacity crossfade.

### 3.4 Frequency Playground
```
┌───────────────────────────────────────┐
│   photo  ⇄  FFT log spectrum (glow)   │
├───────────────────────────────────────┤
│  spectrum with draggable mask rings   │
│     ◜◝  low-pass  ◞◟ high-pass        │
├───────────────────────────────────────┤
│  inverse result (128–256 px)          │
│  cutoff ●───  order ●──  [Explain]    │
└───────────────────────────────────────┘
```
- **Signature:** photo ↔ FFT magnitude spectrum (log, glowing); draggable low/high/band mask; inverse FFT result updates live; shows blur=LP, edges=HP.
- **Shared values:** `cutoff`, `band`, `order`, `maskType` (store), `viewMix` (0 photo..1 spectrum), `time`.
- **Engine calls:** `zeroPadPow2`, `fft2d`, `spectrumMagnitude`, `ideal|gaussian|butterworth LP/HP/BP`, `fftShift`, `ifft2d`, `normalize`.
- **Perf risk:** 2-D FFT on 256² in Hermes each change. **Mitigation:** precompute FFT once per image; only re-mask + IFFT on drag (debounced); 128 px during drag, 256 px on release.
- **Fallback:** mask applies on release only; 128 px cap.

### 3.5 Colour Space Explorer
```
┌───────────────────────────────────────┐
│        ·  cloud (≤2000 pts)           │
│     ·   ·   ○ rotate by drag          │
│   ·  ·  ·   ·                         │
├───────────────────────────────────────┤
│ RGB cube │ HSV cone │ Lab  (segmented)│
│ channel tiles R G B H S V L a b       │
│ hue ●───  sat ●───   [Explain]        │
└───────────────────────────────────────┘
```
- **Signature:** pixels as a 3-D point cloud, rotatable; hue/sat slider moves cloud; channel-split grayscale tiles.
- **Shared values:** `rotX`, `rotY`, `hue`, `sat`, `space` (store).
- **Engine calls:** sample ≤2000 points, `rgb2*`, `*2rgb`; projection in a worklet.
- **Perf risk:** JS projection of 2000 pts/frame. **Mitigation:** project in worklet to a `Float32Array` → single Skia `Points`; 2000 cap; low tier 800 pts.
- **Fallback:** static cloud, drag rotates via cheaper 2-D shear approximation.

### 3.6 Edge Detection Race
```
┌───────────────────────────────────────┐
│  photo + neon traces (sobel/prewitt/  │
│  laplacian/canny) overlapping         │
├───────────────────────────────────────┤
│  timeline: blur|grad|NMS|hyst ●───    │
│  low ●──  high ●──   [Explain]        │
└───────────────────────────────────────┘
```
- **Signature:** 4 algorithms as animated neon traces; Canny stages scrubbed with a timeline.
- **Shared values:** `algorithm` (store), `low`, `high`, `stage` (0..3), `trace` (0..1 draw-on), `time`.
- **Engine calls:** `sobelEdges`, `prewittEdges`, `laplacian`, `canny` (+ exposed stage intermediates).
- **Perf risk:** Canny on every slider tick. **Mitigation:** debounce; cache stage buffers; only re-run hysteresis on threshold change.
- **Fallback:** Canny only (no race), 256 px.

### 3.7 Morphology Sandbox
```
┌───────────────────────────────────────┐
│ threshold ●──  SE: ○disk □sq ✚cross   │
│ size ●──    erode dilate open close    │
├───────────────────────────────────────┤
│  binary view animating grow/shrink    │
│  top-hat inset panel                  │
└───────────────────────────────────────┘
```
- **Signature:** threshold + structuring element; erode/dilate/open/close animate pixel growth/shrink; top-hat inset.
- **Shared values:** `threshold`, `seSize`, `seShape` (store), `op` (store), `morphMix` (0..1), `time`.
- **Engine calls:** `threshold`, `erode`, `dilate`, `open`, `close`, `morphGradient`, `topHat`.
- **Perf risk:** repeated morphology. **Mitigation:** compute erode/dilate once, derive open/close/gradient by composition from cached buffers.
- **Fallback:** single op at a time, no animation.

### 3.8 Enhance Studio
```
┌───────────────────────────────────────┐
│  [Auto Enhance]  stepper:             │
│  WB → Denoise → CLAHE → Unsharp       │
│  ○──○──○──○   tap stage = before/after│
├───────────────────────────────────────┤
│  before│after liquid seam             │
│  [Explain]                            │
└───────────────────────────────────────┘
```
- **Signature:** one-tap pipeline shown as a stepper; each stage previewed as a chip; tap a stage → before/after.
- **Shared values:** `stageIndex`, `seamX`, `time`.
- **Engine calls:** `grayWorldWB`/`whitePatchWB` → `bilateral`/`median` → `clahe` → `unsharpMask`.
- **Perf risk:** 4 heavy stages at once. **Mitigation:** process sequentially with progress, cache each stage output; only the selected stage previews.
- **Fallback:** run stages on 256 px preview; export at full res.

### 3.9 Colour Transfer
```
┌───────────────────────────────────────┐
│  source      reference (pick)         │
│  ┌─────┐     ┌─────┐                  │
│  └─────┘     └─────┘                  │
├───────────────────────────────────────┤
│  result + palette blobs (mean/σ shift)│
│  strength ●──   [Explain]             │
└───────────────────────────────────────┘
```
- **Signature:** pick reference photo; Reinhard transfer in Lab recolours source; palette blobs show mean/σ shift.
- **Shared values:** `strength`, `blobA/B`, `time`.
- **Engine calls:** `rgb2lab`, `lab2rgb`, `colorTransferReinhard`, palette k-means.
- **Perf risk:** Lab conversion on full proxy. **Mitigation:** 256 px preview; cache source Lab once.
- **Fallback:** strength only, no animated blobs.

---

## 4. Week-by-week task breakdown (≤ ½ day each, §18.8)

Marks: `★` must ship for first review · `○` stretch · cut order at the end of each week.

### Week 1 — Foundation + engine core + import (gate: `npm test` green, app boots in Expo Go, import→display)

> **Gate status (2026-10-20): PASSED.** Automated gates ✓ (`tsc`, ESLint, Jest, Android export, `expo-doctor` 20/20); owner confirmed in Expo Go on device (2026-10-20, "okay nice" → proceed to Week 2). Device-side metrics (fps, per-op timings) were not captured in that session and remain owed for §7.1.
- [x] **W1.1** `create-expo-app` + install pinned deps (§1.1) · DoD: `npx expo start` boots in Expo Go · files: `package.json`, `app.json`, `tsconfig.json` · **DEVICE-PENDING** (bundle verified)
- [x] **W1.2** ESLint/Prettier + jest config + `.gitignore` · DoD: `npm run lint`, `npx tsc --noEmit`, `npm test` run (empty suite ok) · files: `.eslintrc.js`, `.prettierrc`, `jest.config.js`, `.gitignore`
- [x] **W1.3** `src/core/tokens.ts` + `motion.ts` from design.md §2/§3 verbatim · DoD: tsc green, values match spec · files: `src/core/tokens.ts`, `src/core/motion.ts`
- [x] **W1.4** `src/core/threads.ts` (scheduleOnRN/scheduleOnUI wrappers, §1.3 C3) + `types.ts` · DoD: exports compile, no reanimated import in engine · files: `src/core/threads.ts`, `src/core/types.ts`
- [x] **W1.5** expo-router shell + fonts + root overlay host · DoD: `/` and `/editor/[id]` mount · files: `app/_layout.tsx`, `app/index.tsx`, `app/editor/[id].tsx`, `app/gallery.tsx`, `app/+not-found.tsx` · **DEVICE-PENDING**
- [x] **W1.6** `src/engine/types.ts` + `buffer.ts` (create/clone/fromRGBA/toRGBA/border modes) · DoD: `buffer.test.ts` green · files: `src/engine/types.ts`, `src/engine/buffer.ts`, `__tests__/buffer.test.ts`
- [x] **W1.7** `color/spaces.ts` + tests · DoD: round-trips ±1/±2 · files: `src/engine/color/spaces.ts`, tests
- [x] **W1.8** `color/adjust.ts` + `color/effects.ts` + tests + SkSL parity fixtures · DoD: known values pass · files: `src/engine/color/adjust.ts`, `effects.ts`, tests · SkSL parity deferred to W2.11 (first shader)
- [x] **W1.9** `spatial/convolve.ts` + `spatial/kernels.ts` + tests · DoD: identity/constant/known 3×3 pass · files: `src/engine/spatial/convolve.ts`, `kernels.ts`, tests
- [x] **W1.10** `enhance/histogram.ts` + `noise/generate.ts` + `noise/metrics.ts` + tests (seeded) · DoD: stats + PSNR/SSIM known values pass · files: `src/engine/enhance/histogram.ts`, `noise/generate.ts`, `noise/metrics.ts`, tests
- [x] **W1.11** `registry.ts` skeleton + `index.ts` facade (`runOperation`, `listOperations`) + registry test · DoD: every op has `explain.*`, valid params, runs on 8×8 · files: `src/engine/registry.ts`, `src/engine/index.ts`, `__tests__/registry.test.ts`
- [x] **W1.12** `src/engine/bridge/skia.ts` (ImageBuffer ⇄ SkImage, C4/C5) · DoD: round-trip byte-identical at 32 px (Spike a) · files: `src/engine/bridge/skia.ts` · **DEVICE-PENDING** (Editor is the harness)
- [x] **W1.13** import pipeline (`expo-image-picker` + `expo-image-manipulator`, C6/C7) + preview proxy · DoD: pick → preview rendered in a Canvas · files: `src/library/files.ts`, `src/library/import.ts` · **DEVICE-PENDING**
- [x] **W1.14** coverage tooling + CI workflow · DoD: `npm test -- --coverage` reports ≥85 % engine · files: `.github/workflows/ci.yml`, `jest.config.js`

**Week 1 report (2026-10-20).** New: `app/` (layout, Home, Editor, Gallery, 404), `src/core/` (tokens, motion, threads, types), `src/engine/` (buffer, colour spaces/adjust/effects, kernels/convolve, histogram, noise, metrics, registry/facade, Skia bridge), `src/library/` (files, import, photo store), `src/morph/` (8 primitives + overlay host), `__tests__/engine/` (6 suites, 61 tests), CI + configs. How to see it: `npx expo start` → open a photo → tap ops and read the timing log; `/gallery` shows every primitive. Engine coverage: **97.55 % statements, 85.37 % branches, 98.75 % lines**; Android export **6.9 MB HBC**, six font weights only. Skipped/deferred: SkSL parity (no shader yet), device fps/round-trip, CI has not run on GitHub yet. Needs owner: Expo Go boot + import→display + one op's timing.

### Week 2 — MVP engine complete + bridge + screens 1 & 2 (gate: both screens ≥55 fps, coverage ≥85 %)
- [x] **W2.1** `noise/denoise.ts` mean + gaussian + tests · files: `src/engine/noise/denoise.ts`
- [x] **W2.2** median + adaptive median + tests (H) · DoD: salt removal confirmed (tests) — `zero` border = classic black padding; lower-middle median
- [x] **W2.3** bilateral + tests (H) · DoD: constant kept + edge preserved ✓ (Rec.709 range LUT, σs→radius clamp 1..5)
- [x] **W2.4** `enhance/stretch.ts` + `enhance/sharpen.ts` + tests
- [x] **W2.5** `color/balance.ts` + `enhance/clahe.ts` + tests (H) — zero-guarded gains; tile CLAHE w/ bilinear LUT + real-valued clip limit
- [x] **W2.6** `spatial/edges.ts` sobel/prewitt + tests — signed inline gradients (convolve would clamp negatives), magnitude normalised by maxSum·√2
- [x] **W2.7** Canny + stage intermediates + tests (H) — `cannyStages()` exposes blur/magnitude/nonMax/edges; hysteresis BFS tested vs NMS
- [x] **W2.8** `frequency/fft.ts` 1-D + 2-D + round-trip tests (H) — iterative radix-2, subarray row pass, ±1e-9 round-trip
- [x] **W2.9** `frequency/filters.ts` ideal/gaussian/butterworth + tests — + band pass/reject, `spectrumImage`; per-channel, zero-padded to pow2
- [x] **W2.10** Engine execution policy: **chunked `await nextFrame()` row-band slicing** chosen (worklet-runtime spike recorded in §7.2; `src/core/worker.ts` is the single adaptation point for `scheduleOnRuntime` later) · files: `src/engine/exec.ts`, `src/core/worker.ts` · banded results tested bit-identical to whole-image runs; **device DoD (512² median, UI never freezes) still owed**
- [x] **W2.11** `src/lab/KernelTheatre.tsx` + shared Skia canvas + sweep animation (screen 1) · DoD: 55 fps on mid-range Android — **device measurement still owed**; design targets it (2 small canvases, ~10 static nodes, derived-value-only animation, one React update per swept cell)
- [x] **W2.12** Kernel edit UI + presets + Explain sheet · files: `src/lab/components/KernelEditor.tsx` — 3×3 numeric cells, blur/sharpen/sobel/emboss presets from engine factories, explicit clamp/reflect/zero border segmented control
- [x] **W2.13** `src/lab/DenoiseArena.tsx` 4-card layout + noise controls (screen 2) — single canvas hosts the four cards (layers not canvases), fixed noise seed so the amount slider scales one realisation, 150 ms debounce (token), banded async executor per card
- [x] **W2.14** PSNR/SSIM badges + crown morph + heatmap toggle · files: `src/lab/components/MetricBadge.tsx`, `Heatmap.tsx` — new `MorphNumber` primitive (rolling digits, reduced-motion fallback); crown springs between cards + gooey pop; heatmap = |Δ| hot ramp (token stops), winner vs original
- [x] **W2.15** Operation log component + Explain sheet wiring · files: `src/lab/components/ExplainSheet.tsx`, `OperationLog.tsx` — every run logged with merged params + ms; Explain renders the registry `explain` block (registry = single source of truth). *Revised R2:* the log UI was removed at the owner's request; `OperationLog.tsx` is deleted and timings are no longer surfaced.
- [ ] **★ review checkpoint**: screens 1 & 2 demo script passable end-to-end

**Week 2 report (2026-10-20).** New: `src/engine/` Week 2 ops (denoise ×5, stretch/autoLevels/CLAHE, unsharp/laplacian, gray-world/white-patch, sobel/prewitt/canny + stages, FFT + 8 frequency ops, registry `halo` policy), `src/engine/exec.ts` + `src/core/worker.ts` (banded async execution, bit-identical to whole-image runs — tested), `src/lab/` (KernelTheatre, DenoiseArena, useLabSource, source helpers), `src/lab/components/` (KernelEditor, MetricBadge, Heatmap, ExplainSheet, OperationLog, LabPill), `MorphNumber` primitive, routes `/lab`, `/lab/convolution`, `/lab/denoise` (Home "Lab mode" card now navigates). How to see it: `npx expo start` → Home → **Lab mode** → Convolution Explainer (kernel window sweeps the 16×16 grid, Σ w·v readout, editable weights/presets/border) and Denoise Arena (noise chips + amount slider → four filters with rolling PSNR/SSIM, crown on the winner, heatmap toggle). Automated gates: `tsc` clean, ESLint clean, Jest **151 tests / 13 suites**, coverage **97.3 % stmts / 89.3 % branches / 99.3 % funcs / 98.5 % lines** on `src/engine` (all thresholds pass). Skipped/deferred: SkSL parity (still no shader — Creative Week 3), worklet-runtime spike C1/C2 numbers (chunked yields shipped instead), device fps (screens 1 & 2) and the 512² median no-freeze DoD — **all three need the owner's device**. Known v1 gaps: crown uses a spring slide (not a full morph path), heatmap strip is winner-only, kernel editor is 3×3 (5×5/7×7 arrive with bigger presets later). Needs owner: open `/lab` on device, paste any redbox text, note fps feel of both screens.

### Design revision R — monochrome + Trace (owner directive 2026-10-20)

Owner feedback after Week 2: the palette must be **white / black / gray** (no violet, cyan or magenta chrome), the UI must feel modern and not "all black", and every filter/noise/sharpen operation must **explain itself on the user's actual photo** — phases that fade into each other, not a separate example image. The algorithm theatre stays, re-styled.

- [x] **R1 Palette** — `src/core/tokens.ts` rewritten as light monochrome (paper `#F6F5F1`, ink `#141412`, graphite/silver/mist, muted semantics); every hard-coded rgba in `src/morph/*` replaced with tokens; `app.json` → `userInterfaceStyle: light`, ink splash; status bar dark; synthetic Lab scene re-authored in grayscale; `design.md` §2/§5/§6/§7 updated (binding).
- [x] **R2 Trace builders** — `src/lab/stages.ts`: real engine stages for `unsharpMask` (original → low-pass → detail → sharpened), median/adaptive median (impulse noise → cleaned), gaussian/mean/bilateral (smoothed → removed detail), noise ×3 (field → noisy), sobel (luma → magnitude), canny (all four `cannyStages` intermediates), equalize/contrastStretch/CLAHE and 9 point ops. Final stage is byte-identical to `runOperation`; notes carry the merged σ/k/amount. 24 tests in `__tests__/lab/stages.test.ts`.
- [x] **R3 Trace screen** — `src/lab/StageTheatre.tsx` + route `app/explain/[op].tsx`: crossfade stack driven by one shared stage position (`opacityᵢ = clamp(1 − |pos − i|)`), `duration.morph` + `ease.emphasized`; autoplay with `labMotion.stageHold`, tap/dot-rail stepping, pause, loop rewind; ink photo window inside the light UI (white edge maps stay legible); formula card + merged param chips; skeleton while heavy ops compute; unknown op ids contained; reduced motion shortens fades and disables autoplay.
- [x] **R4 Entry points** — editor section "See the maths · on this photo" (Sharpen, Denoise, Median, Noise, Edges, Canny, Equalise, Grayscale, Invert, Sepia, Posterize) passing the photo id + exact params; Denoise Arena "Trace winner".
- [ ] **R5 Device verification** — open Trace from the editor and from the Arena on device; confirm the crossfades feel ≥55 fps, the stages are readable, and no redbox appears. Paste any error text.

**Design revision R report (2026-10-20).** New: light monochrome token system, all morph/lab components de-hardcoded, grayscale synthetic scene, `src/lab/stages.ts`, `src/lab/StageTheatre.tsx`, route `/explain/[op]`, editor + arena trace entry points, `labMotion.stageHold`, 24 stage tests. How to see it: Home → open a photo → scroll below the ops → tap **Sharpen** under "See the maths · on this photo": four stages fade through Low-pass → Detail → Sharpened on that same photo; tap the image to advance, dots to jump, pause to hold. Automated gates: `tsc` clean, ESLint clean, Jest **175 tests / 14 suites**, engine coverage unchanged at **97.3 / 89.3 / 99.3 / 98.5**. Skipped/deferred: Trace for convolution/FFT ops (KernelTheatre already animates convolution; spectrum has its own Lab screen), slider-driven live stage params (Trace opens with the editor's fixed params), and the app icon is still the stock Expo asset (only visible in a dev build, not Expo Go). Needs owner: device pass on the fades + palette readability, then the Week 2 ★ checkpoint and Week 3 start.

---

### Design revision R2 — controllable Trace + maths/code panel (owner directive 2026-10-20)

Second owner pass on the device build: the Trace phases advanced faster than he could study, the Lab screens were too long, the theatres silently used the editor's photo instead of letting him choose one, the adjustment chips looked broken (truncated labels, odd dot/outline), and the operation log read as developer noise. He asked for manual control, an adjustable sharpening value with the result visible, motion-graphics maths plus the actual code at the bottom, and a shorter layout.

- [x] **R2.1 Compact chips** — `MorphChip` rebuilt as a label-sized 40 px pill (paper + hairline → ink fill + paper text). No dot, no 64×84 tile, no truncation; gallery/editor inherit it; `radius.chip` tokens removed; `design.md` §4 updated.
- [x] **R2.2 In-theatre photo choice** — `src/lab/components/PhotoChooser.tsx` (thumb trigger → sheet with all session photos + import) on Trace, Convolution Explainer and Denoise Arena. Each screen owns `selectedId`, feeds it to `useLabSource`, and rebuilds its engine pipeline on change; "Trace winner" now passes the chosen photo id.
- [x] **R2.3 Manual playhead** — `src/lab/PhaseScrubber.tsx` owns a continuous shared position; dragging morphs the real stages with no snap, Original/Result jumps guarantee both ends, autoplay is opt-in (default paused), reduced motion disables it. The stage title/note explainer stays above the photo.
- [x] **R2.4 Adjustable parameter + visible result** — `TRACE_CONTROLS` + `traceControlValue` in `stages.ts`, min-anchored to the registry grid. Sharpen exposes amount, gaussian σ, mean/median/adaptive windows, bilateral range σ, noise strengths, Canny σ, CLAHE clip. Committing rebuilds every stage and parks on the final result; route params seed the slider.
- [x] **R2.5 Maths in motion + typed code** — `src/lab/MathPanel.tsx`: Maths tab shows the formula, a Skia plot of the most-changed probe pixel's grey level in every stage (cursor tied to the playhead), a live readout and tappable stage values; Code tab typewrites a real engine excerpt from `src/lab/codeExcerpts.ts` (Replay button). A probe crosshair is drawn on the photo in the same Skia canvas.
- [x] **R2.6 Shorter, log-free chrome** — editor canvas height 0.42 h and no operation log; KernelTheatre's 3×3 editor moves into a "Kernel & border" sheet (screen is much shorter) and its log is gone; Denoise Arena log is gone; Trace fits one screen (compact mode under 760 dp). `OperationLog.tsx` deleted. `design.md` §5.4/§6.4 and `architecture.md` §18.3 updated.
- [x] **R2.7 Tests/gates** — probe/values invariants, control↔registry parity, min-anchored stepping and code-excerpt coverage added to `__tests__/lab/stages.test.ts`; `tsc` clean, ESLint clean, Jest **201 tests / 14 suites**, engine coverage unchanged **97.3 / 89.3 / 99.3 / 98.5**, Android export succeeds, expo-doctor 20/20.
- [ ] **R2.8 Device verification** — choose a photo inside Trace/Convolution/Arena, drag the playhead, change Sharpening and confirm the new result + plot numbers update, open Maths/Code/عربي, verify the layout fits and fps ≥55. In **Kernel & border**, confirm the default matrix is centre `1` with zeros, the preview is not black, the three border cards read 59/76/30, and the Arabic guide's matrices are readable. In **Denoise Arena**, confirm the source/noisy image paints immediately, each filter card fills in as it finishes, and tapping a card opens its Arabic explanation. Paste any redbox text.
- [x] **R2.9 Owner polish (Home + Arabic)** — Home mode cards are compact full-width rows instead of a two-column flex row; this removes the zero-width sibling that wrapped its copy vertically and stretched the Lab card to ~400 dp. Convolution Explainer gains a collapsed **ArabicGuide** under the Σ card: what the 16×16 view shows, kernel, luma formula, every symbol, what changing weights does, and a try-it path. Arabic copy deliberately omits `fontFamily` (the brand faces have no Arabic glyphs) and uses the platform Arabic face; the guide is reusable and costs one 64 px row when closed.
- [x] **R2.10 Kernel clarity + border fix** — The convolution defaults were accidentally seeded from `CHANNEL_MIXER_IDENTITY` (`1 0 0 / 0 1 0 / 0 0 1`), a colour matrix rather than a spatial kernel; they now use the spatial identity (`0 0 0 / 0 1 0 / 0 0 0`), so the theatre opens on an unchanged image. Empty weight fields no longer become `Number('') === 0` (which could zero the centre and black out the preview); invalid/empty input reverts, values clamp to the registry's ±8, and there is an **Identity** preset. The three border pills are now selectable explanatory cards with a top-left corner example under a 3×3 average kernel: shaded outside cells and results **59 / 76 / 30** make Clamp/Reflect/Zero visible. The Arabic guide is shortened to matrix → weighted processing → Σ → editing → border, with a worked 3×3 kernel/pixel example. Result images are retained for one generation before disposal to avoid a black flash while Skia switches frames. Tests: `parseKernelWeight`, border-example arithmetic, and a convolve-default identity test added; Jest **209 tests / 16 suites**.
- [x] **R2.11 Denoise responsiveness + Arabic concepts** — Denoise Arena now uses a 192 px proxy (the cards are ~160 dp), shows the clean source and then the noisy input immediately, and fills each filter card independently instead of waiting for all four. In-flight runs are cancelled when the noise type/amount changes, metrics show an em-dash until each result lands, image replacement is retired one frame later, and the grid height now includes both badge rows. The screen gains a collapsed Arabic guide explaining noise and each of the four filters. `src/lab/arabicExplain.ts` gives every registered operation a short, child-level Arabic idea; `ArabicOperationGuide` appears in every Explain sheet, and Trace's bottom panel gains an **عربي** tab beside Maths/Code. The Convolution guide is rewritten as the owner's story: image = numbers → edge = difference → sliding 3×3 → multiply/add → Σ → 190 worked example → presets. Tests: `__tests__/lab/arabicExplain.test.ts` (coverage, no orphans, short entries, sharpen story); Jest **213 tests / 17 suites**.

**Design revision R2 report (2026-10-20).** New: compact MorphChip pills; `PhotoChooser`; `PhaseScrubber`; `MathPanel`; `codeExcerpts.ts`; `TRACE_CONTROLS`/`traceControlValue`/probe values in `stages.ts`; Trace route owns its selected photo; KernelTheatre kernel sheet; operation log deleted everywhere; editor/arena shortcuts; docs updated. How to see it: Home → **Lab mode** → Denoise Arena → tap the photo chip under the title and choose/import a photo → **Trace winner**; on Trace drag the playhead slowly through Original → Result, tap **Original/Result**, change **Sharpening** and release (the screen parks on the new result), then switch the bottom panel between **Maths** (plot cursor + values) and **Code** (typewriter). Automated gates as above. Skipped/deferred: per-op animated diagrams beyond the probe plot (kernel/neighbourhood diagrams stay in the Lab screens), Trace for convolution/FFT ops, editor-side heavy-op sliders (Week 3), and device fps/DoD measurements. Needs owner: the R2.8 device pass and any redbox text; then the Week 2 ★ checkpoint can be ticked and Week 3 started.

**R2.9 report (2026-10-20).** Home no longer renders the Lab/Creative cards in a two-column flex row: each is a full-width 64–66 dp row (icon, title, status, one-line body, chevron for the live one). This fixes the actual bug — the unconstrained Lab pressable took its max-content width, squeezed Creative to ~0, and Creative's wrapped copy stretched the row. The Convolution Explainer now has **اشرح لي بالعربية** under the Σ card, collapsed by default: a 16×16 view legend, kernel walkthrough, luma formula, symbol glossary, weight-effect table, and a try-it sequence. The guide uses the phone's Arabic face because Inter/Space Grotesk/JetBrains Mono lack Arabic glyphs. How to see it: Home (mode rows are short) → **Lab mode** → **Convolution Explainer** → tap **اشرح لي بالعربية**; the animated part above is unchanged. Gates: `tsc` clean, ESLint clean, Jest 201/201, Android export succeeds. Device fps/DoD still owed under R2.8.

**R2.10 report (2026-10-20).** Fixed the black/wrong convolution preview: the registry was building its default weights from the colour channel-mixer identity, so the theatre opened with a diagonal three-pixel sum instead of `0 0 0 / 0 1 0 / 0 0 0`. Empty kernel fields also committed as zero on blur (`Number('') === 0`), which could zero the centre when tapping Clamp; empty/invalid input now reverts, and there is an **Identity** preset to recover. **Kernel & border** now explains itself: the three border modes are selectable cards, each with a shaded top-left corner window and the average result for a 3×3 average kernel — **Clamp 59 · Reflect 76 · Zero 30** — plus an Arabic line saying why the full preview barely changes (only the outer 1-pixel ring is affected). The Arabic guide is now a short worked example: the matrix is the kernel, each weight multiplies the luma under it, the nine products are summed (Σ = sum), the result is written to the centre and the window slides; the guide shows a 3×3 sharpen kernel × pixel patch → 190, then how to edit, then border. The Σ card legend spells out `w`, `v`, and `Σ`. How to see it: **Lab mode → Convolution Explainer → Kernel & border**; the default matrix should be centre `1`, everything else `0`, the preview should show the chosen photo, and the three border cards should show 59/76/30. Then tap **اشرح لي بالعربية** under the Σ card. Gates: `tsc` clean, ESLint clean, Jest **209 tests / 16 suites**, Android export succeeds. The prior black-screen report could not be reproduced on a device from here; the default-kernel and empty-input defects are the concrete causes fixed. If a black preview persists, send a screenshot with the sheet open.

**R2.11 report (2026-10-20).** Denoise Arena was doing four 384² filters at once and only committing images after every filter (plus all metrics) finished; on a phone that looked like blank cards and a frozen screen. It now runs on a 192 px proxy, paints the clean source immediately, then the noisy input, and swaps each filter card and its PSNR/SSIM in independently. Changing the noise model or amount aborts the in-flight generation instead of queueing another four filters; replaced SkImages are retired after the canvas swaps; the grid height includes both badge rows. The screen also has a collapsed Arabic guide for the noise model and each filter. **Arabic concepts:** `arabicExplain.ts` now covers all 40 registered operations with a one-sentence idea plus two or three concrete beats, not a symbol glossary. Tapping any filter's Explain sheet shows its Arabic idea; Trace's bottom panel has a third **عربي** tab beside Maths/Code, so each filter explains itself on its own photo. The Convolution guide is rewritten as the requested story — image is a grid of numbers (0 black, 255 white), an edge is a difference, a 3×3 window slides and multiplies/adds, Σ is just “sum”, the sharpen kernel × patch gives 190, then try Identity/Blur/Sharpen. How to see it: **Home → Lab mode → Denoise Arena** (images appear immediately; tap a card for its explanation); **Trace** any sharpening operation → bottom **عربي**; **Convolution Explainer** → **اشرح لي بالعربية**. Gates: `tsc` clean, ESLint clean, Jest **213 tests / 17 suites**, Android export succeeds, expo-doctor 20/20. Device fps/DoD and the R2.8 pass are still owed; if Denoise still looks blank on the phone, send a screenshot with the noise model and `Source` caption visible.

---

### Week 3 — screens 3, 4, 8 + Creative mode + HUD (gate: full Lab path no crashes)
- [x] **W3.1** `src/lab/HistogramSurgery.tsx` histogram + CDF paths (screen 3) · files: `src/lab/HistogramSurgery.tsx`, `src/lab/components/HistogramPlot.tsx`, route `/lab/histogram` · 64-bin luma histogram + CDF at 96 px analysis, 150 ms debounce
- [x] **W3.2** equalize/CLAHE/stretch + liquid seam + LUT editor · files: `src/lab/components/LiquidCompare.tsx`, `src/lab/components/ToneCurve.tsx`, `src/lab/toneCurve.ts`, `src/engine/enhance/lut.ts` · equalize/CLAHE/stretch with luma/RGB + tile/clip controls; draggable five-point tone curve → 256-entry LUT; `applyLut` engine pass + tests
- [x] **W3.3** `src/lab/SpectrumPlayground.tsx` photo↔spectrum toggle + mask UI (screen 4) · **built, then removed by the owner (2026-10-21: "I don't understand it — leave it until we do")** · the engine parts survive: `src/engine/frequency/mask.ts` (`radialMask` + registry op + Arabic idea + tests)
- [x] **W3.4** FFT mask drag + debounced inverse (screen 4) · **built, then removed with the screen** · the `radialMask` engine operation stays available for the Trace
- [x] **W3.5** `src/lab/EnhanceStudio.tsx` stepper + stage cache (reuse `stages.ts`; Trace is the per-op view) · files: `src/lab/EnhanceStudio.tsx`, route `/lab/enhance` · white balance → denoise → CLAHE → sharpen; every stage buffer is cached so a chip shows its own before/after for free; "Auto enhance" preset
- [ ] **W3.6** `src/lab/ColourTransfer.tsx` ○ (screen 9) — first cut candidate
- [x] **W3.7** Creative canvas · **built, then removed by the owner (2026-10-21: "not needed")** — the canvas, the filter dock and the 96 px HUD histogram are gone; the engine filters remain as documented algorithms
- [x] **W3.8** 6 launch filters: Aurora, Liquid, Vortex, Glitch, Duotone, Noir + registry · files: `src/engine/creative/filters.ts`, `src/engine/registry.ts` — all six are pure, deterministic engine operations (O(N)) with Arabic ideas and tests; **not surfaced in the UI any more** (the Creative mode was removed), kept in the catalogue for the future
- [ ] **W3.9** 5 transition shaders + `useApplyFilter` The Drop (arch §6.5) — *deferred:* the crossfade drop ships, the five SkSL transitions and the finger-driven origin do not
- [ ] **W3.10** Visualizers for the 6 filters (arch §7) — *deferred*
- [ ] **W3.11** HUD histogram (96 px analysis, §8.1) + palette blobs — *progress:* the 96 px HUD histogram and its morph ship in Creative mode; the palette blobs and the hue ring do not
- [x] **W3.12** Home screen: two doors + recent grid (static thumbs) · files: `app/index.tsx` — **reworked by the owner (2026-10-21)**: the Home now shows only *Edit a photo* (the editor) and *Lab mode*, centred, with no counters, no session grid and no other cards — the first screen says exactly what the app can do
- [ ] **W3.13** Design revision carry-through: monochrome filter ramps (design.md §7), Trace entry points for every new adjustment, and trace params that follow committed slider values. *R2 progress:* Trace now has its own registry-aligned primary control and parks on the result; the remaining piece is editor-side per-op sliders feeding the trace.

**Week 3 progress report — W3.1–W3.2 (2026-10-21).** New: `src/lab/HistogramSurgery.tsx`, `HistogramPlot`, `LiquidCompare`, `ToneCurve`, `toneCurve.ts`, `applyLut` in `src/engine/enhance/lut.ts`, route `/lab/histogram`, and a third LIVE tile in the Lab hub. The screen paints the selected photo immediately, analyses a 96 px proxy into a 64-bin luma histogram + CDF, and debounces the 512 px result by 150 ms. **Equalize** spreads via the global CDF, **CLAHE** exposes tile count + clip limit, **Stretch** exposes luma/RGB range, and **Curve** gives five draggable points → a 256-entry LUT with Linear/Soft S/Contrast/Lift presets. The before/after photo comparison has a draggable liquid seam; the histogram overlays pale before fill, ink after line, and both CDFs. Every method has its Explain sheet + Arabic guide; the screen also has a child-level Arabic explanation of pixels, histograms, CDF, equalize, CLAHE, stretch and curves. How to see it: **Home → Lab mode → Histogram Surgery** (or `/lab/histogram`) → choose a photo → move the seam → switch Equalize/CLAHE/Stretch → **Curve** → drag a point. Automated gates: `tsc` clean, ESLint clean, Jest **222 tests / 19 suites**, engine coverage **97.87 / 96.42 / 100 / 99.2**, Android export **7.2 MB HBC**. Skipped/deferred: no SkSL tone-curve live drag (results wait for the 150 ms commit), no separate Colour Transfer/Enhance/Spectrum screens yet, and no device fps or 512 px DoD numbers. Needs owner: open the new screen on Expo Go, confirm the seam/curve gestures and the histogram read clearly, and report any redbox text; the Week 3 gate remains open until W3.3–W3.12 land and the full path is crash-free.

**Week 3 progress report — W3.3–W3.12 (2026-10-21).** New: **Frequency Playground** (`/lab/spectrum`) with the log-magnitude spectrum, a draggable radial mask (the ring radius *is* the cutoff D0) and a live inverse FFT — the inverse runs on a 128 px proxy while the finger is down and on the 256 px proxy when it lifts; the new engine op `radialMask` (+ registry entry, Arabic idea, 8 tests) does the masking. **Enhance Studio** (`/lab/enhance`) runs white balance → denoise → CLAHE → sharpen and caches every stage, so a chip shows that step's own before/after for free; "Auto enhance" sets a balanced preset. **Creative mode** (`/creative`) is live from the Home card: a hero canvas, the six launch filters (Aurora, Liquid, Vortex, Glitch, Duotone, Noir — all engine operations in `src/engine/creative/filters.ts`, so they work in the editor and the Lab too), a strength slider, and the 96 px HUD histogram that morphs with the look; "The Drop" ships as a 560 ms crossfade. The Lab hub now lists five live screens and three locked ones. Automated gates: `tsc` clean, ESLint clean, Jest **237 tests / 21 suites**, engine coverage **97.87 / 96.42 / 100 / 99.2**, Android export **7.2 MB HBC**, `expo-doctor` 20/20. Skipped/deferred: the five SkSL transition shaders and the filter visualizers (W3.9/W3.10), the palette blobs / hue ring (W3.11), Colour Transfer (W3.6), the finger-driven transition origin, and the SkSL twins of the six creative filters — the engine versions are the reference implementation for now. The Week 3 gate is still **open**: the Creative chain is engine-based, not the SkSL pipeline of arch §6.4/§6.5, and no device fps or crash-free pass has been recorded. Needs owner: walk **Home → Lab mode** through the five screens and **Home → Creative**, and report any redbox text, slow frame or gesture that does not respond.

**Owner fix pass R2.12 (2026-10-21).** The device pass found four real defects, all fixed:
1. **Before/after were swapped** — `LiquidCompare` clipped the *result* on the left, so the change appeared under the BEFORE label. The result is now the base layer and the source is clipped on the left, so the right of the seam always carries the change (affects Histogram Surgery and Enhance Studio).
2. **A touch mark on every Denoise card** — the invisible `MorphPressable` over each card dimmed the photo while pressed and left a visible stain. The card tap target is a plain `Pressable` now.
3. **The arena looked like it added noise** — the cards were a 192 px proxy blown up to ~480 px, so every result was fuzzier than the original photo and the injected noise (σ up to 20) dominated. The arena now runs on a 384 px proxy with a gentler noise (σ = amount·32, default amount 0.3), shows the clean photo as an "Original" reference chip, and prints the winner as `clean photo → after denoise` side by side.
4. **Enhance Studio made photos worse** — the "denoise" step was a *gaussian* blur (detail loss, no noise removal) and "Auto enhance" ran a strong white balance (tinting) with a strong blur. The step is now **bilateral** (edge-preserving), the proxy is 384 px, and Auto is deliberately gentle (WB 0.3, range σ 18, CLAHE clip 2, sharpen 0.5). The Frequency Playground spectrum is now smoothed and gamma-lifted (`spectrumImage` gained `smooth` and `gamma` params, with tests) and the screen opens on the photo instead of the spectrum.
The owner also asked for less depth in the explanations: the Arabic guides in the new screens are cut to two or three short blocks, and the long English paragraphs are gone. Automated gates after the fixes: `tsc` clean, ESLint clean, Jest **239 tests / 21 suites**, engine coverage unchanged above the 85 % gate, Android export **7.2 MB HBC**. Still owed from the owner: a device pass on the four fixed screens.

**Owner fix pass R2.13 (2026-10-21).** Second device pass:
1. **Redbox on every open: "[Worklets] Tried to synchronously call a Remote Function. Called 'plotY' on the UI Runtime"** — `MathPanel`'s `useDerivedValue` called the module-level helper `plotY`, and a worklet may only call other worklets. The helper is now a worklet *and* the cursor maths is inlined, so the Trace panel cannot fail this way again. (The error stayed on screen after navigating back because the Trace screen stays mounted in the stack — a reload cleared it, which is why it looked intermittent.)
2. **CLAHE "ruins the look"** — it is now **off by default** and out of the "Auto enhance" preset; the step stays available with a one-line note ("local contrast — can look harsh, so it starts off"). Every step also gets its own one-line note, and a switched-off step still shows what it *would* do (its own output is computed for the chip).
3. **The "locked" Lab tiles are gone** — the hub lists only the screens that work (owner: "remove them, we are not going into their details").
4. The Denoise Arena was judged "fine, no big difference" — left as it is.
5. The Frequency Playground was not understood yet — deliberately left alone ("we will leave it until we understand it"); no further work on that screen.
Gates after the pass: `tsc` clean, ESLint clean, Jest **239 tests / 21 suites**, Android export **7.2 MB HBC**.

**Stability pass R2.14 (2026-10-21, owner asleep).** The owner asked for a stability/QA pass without touching permissions. What was found and fixed:
1. **"GO_BACK was not handled by any navigator"** — every screen called `router.back()`, which warns when the screen was opened directly (deep link, cold start). All of them now go through `src/core/navigation.ts#goBack`, which falls back to Home.
2. **GPU image lifetimes** — `src/lab/imagePool.ts` is now the single owner of Skia images: retired images are released *after* the canvas swapped (the Trace screen used to dispose them synchronously, which could blank the frame or use a disposed image), and every retirement timer is cleared on unmount. The Heatmap and `useLabSource` got the same treatment; the synthetic scene became a process-wide singleton so no screen builds and leaks its own copy.
3. **The editor re-read the whole 1080 px preview from the GPU on every tap** — the readback is now cached per photo, which is what made the editor feel laggy.
4. **The spectrum ring and the tone curve re-rendered the whole screen at 60 fps** — the ring now follows the finger in local state and commits once on release; the heavy children (histogram, compare) are memoised.
5. **Enhance Studio recomputed all four steps for any change** — the stage cache is now *resumed*: only the steps after the first dirty one are recomputed.
6. **The session library grew forever** — the store keeps at most eight imports and deletes the evicted photos' files from the sandbox.
7. **QA harness (new)** — `__tests__/qa/screens.test.tsx` mounts all ten screens, checks their titles and unmounts them with **zero console errors**; `__tests__/qa/invariants.test.ts` guards the rules the app must never break again (no bare `router.back()`, no debug logs, no "LOCKED" tiles, every operation has an Arabic explanation, the engine stays free of UI imports). `jest.resolver.js` makes Reanimated/Worklets load their web build under Jest.
8. **A blank compare is now a shimmer** instead of a black rectangle while the first result is computed.
9. **The GPU readback is cached** (one photo, one proxy): moving between Lab screens with the same photo no longer copies ~5 MB back from the GPU on every mount.
10. **The Arabic copy moved to one file** (`src/lab/arabicGuides.tsx`) and the Denoise catalogue to `src/lab/denoiseFilters.ts`, so the owner edits the Arabic in one place and the screen files are only about the screen.
Gates after the pass: `tsc` clean, ESLint clean, Jest **255 tests / 23 suites**, engine coverage above the 85 % gate. `docs/AGENTS.md` now records this snapshot as the **stable baseline** before the next, larger refactor.

**Owner simplification pass R2.15 (2026-10-21, late evening).** The owner looked at the app on the phone and asked for less, not more:
1. **The blur preview was a black screen — and it was a real bug.** The "Blur" preset handed the engine `gaussianKernel(1)`, which is a **7×7** matrix (49 weights), while the editor and the engine are 3×3. The first nine cells were mapped onto the matrix, the kernel summed to ≈0 and the whole output went black (the Σ readout showed 0·68 + 0·76 + … and Σ = 0.7 — the tell-tale). Fixed with a new `gaussianKernel3x3(sigma)` factory, a **3×3 guard** in `convolveParams` (a wrong-sized kernel is now rejected instead of mis-mapped) and `__tests__/lab/kernelPresets.test.ts` (5 tests: every preset is 3×3, a blur keeps the picture bright, a 7×7 kernel throws).
2. **The app must never look frozen** — every edit now shows a working state: the editor runs through `runOperationAsync` (which yields a frame first) and shows a "WORKING…" badge, the Convolution Explainer shows a shimmer instead of a black panel while it convolves, and the Lab comparisons show their own "BUILDING…" pill. The rule is now written into `docs/AGENTS.md`.
3. **The Frequency Playground was removed** (`/lab/spectrum`, the screen, the tile, the QA case). The `radialMask` engine operation, its Arabic idea and its tests stay in the catalogue.
4. **Creative mode was removed** (the Home card, `/creative`, the screen, the HUD histogram). The six creative filters stay in the engine as documented algorithms.
5. **The Primitives gallery was removed** (`/gallery` and its Home button).
6. **The Home now has exactly two doors**, centred: *Edit a photo* (the editor — the only way to edit an image) and *Lab mode*. No counters, no session grid, no other cards.
7. **The toolbox is now written down** in `docs/AGENTS.md`: the reusable pieces (image pool, goBack, arabicGuides, toneCurve, kernelInput, the QA sweep, `npm run dev`, …) and the two hard rules (never look frozen; reuse what is built).
Gates after the pass: `tsc` clean, ESLint clean, Jest **257 tests / 24 suites**, Android export 7.2 MB, `expo-doctor` 20/20.

**Home/Lab visual pass R2.16 (2026-10-21, late).** The owner liked the palette and the buttons but not the look: *"not enough wow, not modern enough — add some things and visuals"*. The chrome was left alone (colours, buttons, spacing) and a **live visual** was added instead:
- `src/home/PixelSweepHero.tsx` — a 16×16 slice of the Lab's synthetic scene, magnified with nearest-neighbour sampling, dissolving into the smooth image underneath while a 4×4 kernel window walks the grid. It is the Convolution Explainer's idea at poster size, monochrome, photo-independent, and driven by a single shared value (no React state in the loop).
- The Home opens on that hero, with a quiet mono caption (*"16×16 pixels, one kernel at a time"*), the wordmark below it, the two doors, and a small strip naming the four Lab screens.
- The Lab hub gets the same hero and numbered tiles (01–04) in mono.
- The Home and the tiles enter with a short staggered fade (Reanimated `entering`), so the first screen has motion instead of a static page.
Gates: `tsc` clean, ESLint clean, Jest **257 tests / 24 suites**, Android export 7.2 MB.

**Owner polish pass R2.17 (2026-10-21, night).** The owner's device review:
1. **The Trace header looked broken** — the title and the photo chip shared one column, so the back/play buttons were vertically centred *between* them and the title appeared to float above the row. The title now sits next to the back button and the chip gets its own row.
2. **The screen jumped while loading** — the Trace was a fixed column whose maths panel grew when the stages arrived, so the content moved down at the end. The panel (and its skeleton) now have **one fixed height**, and the whole screen scrolls.
3. **Loading was slow** — the Trace builds every stage on the JS thread; at a 512 px proxy that is 123 ms in Node (≈400 ms on the owner's Helio G95). The proxy is now **384 px** (57 ms in Node), and the build runs **after a frame**, so the skeleton and a "COMPUTING…" badge are on screen while it works. Before, the JS thread was blocked, the skeleton never painted, and the image simply jumped.
4. **The Code tab is now Python** — the course language. `src/lab/codeExcerpts.ts` holds the Python version of every step (20 excerpts), the panel is labelled *PYTHON · SIMPLIFIED EXCERPT*, and a test now fails if an excerpt is not Python. **The app's own code stays TypeScript** — only what the reader sees changed.
5. **Credit on the Home** — "developed by Omar Mohamed" with a travelling highlight on a hairline (`src/home/Credit.tsx`).
Gates: `tsc` clean, ESLint clean, Jest **257 tests / 24 suites**, Android export 7.2 MB.

### Week 4 — polish, docs, demo (gate: rehearsed 5-min demo, Expo Go ready)
- [ ] **W4.1** Edge Race ○ / Colour Explorer ○ (only if W1–W3 green)
- [ ] **W4.2** Morphology Sandbox ○
- [ ] **W4.3** Explain sheets complete for every registry op
- [ ] **W4.4** Home container transforms (SKILL §5.2) + editor route `animation:'none'`
- [ ] **W4.5** Export: full-res render (arch §9.3) + save/share (C4/C7)
- [ ] **W4.6** a11y + reduced-motion audit (design.md §9, SKILL §8)
- [ ] **W4.7** `docs/ALGORITHMS.md` per algorithm (viva cheat sheet) — **started in Week 1** with all shipped algorithms; expand each week.
- [ ] **W4.8** Demo script rehearsal + sample photos (CC0) + APK/Expo Go check
- [ ] **W4.9** Buffer/rework day (reserved)

**Must ship (first review):** W1.* (all) · W2.1–W2.5, W2.8–W2.15 · W3.1–W3.5, W3.7–W3.12 · W4.3–W4.5, W4.7, W4.8.
**Cut order (last cut first):** Colour Transfer → Morphology → Edge Race → Colour Explorer → extra Creative filters (never cut tests, comments, or screens 1/2/3/4).

---

## 5. Test plan (no device required)

- **Runner:** `jest-expo`; engine tests run in the `node` environment (`testEnvironment: 'node'` for `__tests__/engine/**`) so Hermes/device is not needed. UI primitives (morp) tested with `@testing-library/react-native`.
- **Fixtures (in code):** `8x8 constant`, `gradient ramp`, `checkerboard`, `impulse pixel`, `known 3x3 patch`, `5x5 plus-shape`, `vertical step edge`, `two-tone pair`. No binary assets.
- **Property tests:** arch §18.5 list — convolution identity = input; box blur of constant = constant; median removes isolated salt; equalization CDF ≈ linear; `FFT→IFFT` ε<1e−4; colour round-trips ±1; PSNR identical guarded, PSNR monotone with noise (fixed seed); `SSIM(identical)=1`.
- **Known-value tests:** hand-computed convolution, Sobel on vertical step, grayscale of pure R/G/B, morphology on 5×5 plus, brightness/contrast/gamma/posterize values in §2.
- **Reference-vs-shader parity:** for every SkSL-flagged light op, a test compares the TS formula against the SkSL formula's documented math on a fixture, tolerance **±2/255**. The SkSL string itself is parsed by the registry test to confirm uniform names.
- **Registry test:** unique ids; every `params[].key` appears as `uniform float <key>` in the SkSL (Creative); every `OperationDef` has `explain.*`, valid params, runs on the 8×8 fixture without throwing.
- **Coverage:** `npm test -- --coverage --collectCoverageFrom='src/engine/**'`; gate **≥85 % lines** on `src/engine/`.
- **Commands (DoD for every phase):** `npx tsc --noEmit` · `npm run lint` · `npm test`. CI runs all three.

---

## 6. Risk register (top 10)

| # | Risk | Likelihood | Impact | Early spike to retire | Fallback |
|---|---|---|---|---|---|
| R1 | Skia image→RGBA bytes→TS→Skia round-trip too slow at 512 px | High | High | Spike (a) day 1 | Cap engine proxy at 384 px; use CPU `Skia.Surface.Make` |
| R2 | 256×256 2-D FFT too slow in Hermes | High | High | Spike (b) day 1 | Precompute FFT once/image; 128 px drag; mask on release |
| R3 | Median ≥5×5 / bilateral freeze UI | High | High | Spike (c) day 1 | Worker runtime (scheduleOnRuntime) else chunked yields; low tier = 3×3 |
| R4 | Memory blow-up with large images / many buffers | Medium | High | Spike (a) + import cap | Refuse >50 MP; clamp export 4096; free buffers after use |
| R5 | Expo Go limitation (native module needed) | Low | High | Phase 0 boot test | Defer the feature; flag "needs dev build" per SKILL §1 rule 3 |
| R6 | Worklets API rename (`runOnRuntime`→`scheduleOnRuntime`) breaks engine exec | Medium | Medium | Read docs §1.3 C1–C3 | `src/core/threads.ts` single adaptation point |
| R7 | Android blur performance (`expo-blur`) frames drop | Medium | Medium | Spike (d) | Opaque `bg.2` fallback; ≤2 BlurViews (design §2.2) |
| R8 | SkSL nested transition shaders too many taps / compile null | Medium | Medium | Phase 3 spike | Collapse to single pass at rest; toast + plain photo on null |
| R9 | CPU/GPU readback stall on `MakeOffscreen` | High | Medium | Spike (a) | CPU surface for readback; GPU only for export |
| R10 | Container transform coordinates mismatch via `measureInWindow` under expo-router | Medium | Medium | Spike (e) day 2 | `entering` fade fallback; root overlay host (arch §10) |

---

## 7. Spikes to run first (day 1–2, throwaway)

| Spike | What | Pass criteria |
|---|---|---|
| **(a)** | Skia image → RGBA bytes → TS processing → Skia image round-trip at 512 px | Round-trip byte-identical; total < 16 ms/frame budget headroom (measure median of 60) |
| **(b)** | 256×256 2-D FFT in Hermes (pure TS) | < 150 ms; < 40 ms at 128×128 |
| **(c)** | 5×5 median at 512 px (TS) | < 250 ms off the UI path without dropped frames (worker or chunked) |
| **(d)** | SkSL uniform-driven brightness slider | Steady 60 fps (≥55) on device; uniforms updated only in `useDerivedValue` |
| **(e)** | Container transform with `measureInWindow` in expo-router | Trigger rect == overlay start rect within 1 px; collapse returns to same rect |

Each spike is a scratch file under `/tmp` or `src/spikes/` (deleted after); record results in this file's margin before Week 1 tasks.

### 7.1 Spike results so far (2026-10-20, Node 24.22.0 on the laptop — **V8, not Hermes**)

Treat every number below as a lower bound. Hermes is typically 3–10× slower on this class of loops; re-measure in the app before locking Lab proxies.

| Spike | Result | Verdict |
|---|---|---|
| (a) Skia round-trip | Not measurable headlessly. The 1080 px Editor path (SkImage → `readPixels` → engine → `SkImage` → Canvas) is the live harness; with the R2 log removed, time it with temporary instrumentation if the number is needed. | **Device-pending.** Open any photo and tap an op. |
| (b) FFT 256² | Forward **3.0 ms** median; forward + inverse **6.5 ms** (radix-2, rows then columns). 512² scales ≈4×. | Budget is comfortable even at 5–10× Hermes slowdown. Keep 256² for interactive spectrum; 512² on release. |
| (c) Median 5×5, 512² luma | Insertion sort **69.7 ms**; 256-bin histogram **36.4 ms** (1.91× faster). Mean 5×5 11.9 ms; Gaussian σ1.4 separable 13.6 ms; bilateral 5×5 + range LUT 19.5 ms. | Choose **histogram median** per channel. RGB triples these numbers; Hermes may push median to ~0.2–1 s. W2.10 off-UI/chunked execution is mandatory; low tier may use 3×3 or 384 px. |
| (d) SkSL brightness | No shader yet (W2.11). | Deferred. |
| (e) Container transform | No transform yet (W4.4); root overlay host is in place at the root so `measureInWindow` coordinates match. | Deferred. |

Fixture: `/tmp/opencode/spikes.mjs` (throwaway, not in the repo). Decision logged: **histogram-based median**, **256² interactive FFT**, **bilateral/median never on the UI thread**.

---

## 8. Demo script (5 minutes) + viva cheat sheet

**Order (best visuals first, ~30–40 s each):**
1. **Convolution Explainer** — glowing kernel slides; numbers multiply; output pixel pops. (fresh, instantly readable)
2. **Denoise Arena** — inject noise, 4 filters race, PSNR/SSIM roll, crown morph, heatmap toggle.
3. **Histogram Surgery** — histogram flattens live; equalize vs CLAHE vs stretch seam.
4. **Frequency Playground** — photo becomes glowing spectrum; drag ring → blur/edges.
5. **Enhance Studio** — one-tap Auto Enhance stepper.
6. **Creative mode** — pick photo, tap Liquid/Aurora; "The Drop" transition + visualizer + HUD morph. (wow close)
7. (if time) **Edge Race / Colour Explorer**.

**`docs/ALGORITHMS.md` structure (viva cheat sheet):** per algorithm — *What · Formula (mono) · Parameters & ranges · Complexity · Pros/cons · Where it is used (screen) · Reference (book chapter, no copied text) · Screenshot placeholder*.

---

## 9. Open questions for the owner (≤6, with recommended defaults)

1. **App identity / directory mismatch** — repo folder is `FilterGLow`, docs name the app *MorphLens*. Default: keep folder `FilterGLow`; `app.json` `name: "MorphLens"`, `slug: "morphlens"`.
2. **Expo SDK pin** — default: **SDK 58** (latest stable, Expo-Go supported).
3. **Heavy-op execution** — worker runtime vs chunked JS thread. Default: chunked `await nextFrame()` (safe, no API churn) for Weeks 1–2; adopt worker runtime only if Spikes b/c demand it.
4. **Image limits** — default: refuse import > 50 MP; clamp export long edge to 4096 px.
5. **Sample photos for the demo** — default: 3 CC0 images (Wikimedia/Unsplash) + synthetic fixtures; no binary assets in tests.
6. **Git commits** — AGENTS forbids commits until name/email given; without identity there is no history for the review. Default: proceed uncommitted; owner to provide name/email by end of Week 1.
