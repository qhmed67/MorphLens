# ALGORITHMS.md — MorphLens viva cheat sheet

> Living document. Weeks 1–2 algorithms are documented below; every new engine
> operation must add an entry in the same change (AGENTS.md). Formulas are
> written from first principles, not copied from any textbook.
>
> Conventions: `N = W·H` pixels, channels are 0..255, kernels are square and
> odd-sized, borders default to `clamp`. Complexity is per full image.

---

## 1. Image model and borders

### RGBA buffer
- **What:** Row-major `Uint8ClampedArray`, four bytes per pixel; alpha is carried through every operation unchanged.
- **Formula:** `index(x,y) = (y·W + x)·4`
- **Complexity:** creation/copy `O(N)`; access `O(1)`.
- **Used in:** every engine function; bridge to Skia.
- **Reference:** Gonzalez & Woods — *Digital Image Processing*, “Image Fundamentals”.

### Border policies (clamp / reflect / zero)
- **What:** How kernels sample outside the image.
- **Formulas:** clamp → nearest edge; reflect → mirror without repeating the edge (`BORDER_REFLECT_101`); zero → transparent black.
- **Why it matters:** clamp keeps flat regions flat at the frame; zero darkens edges under smoothing kernels; reflect avoids the edge-replication bias.
- **Complexity:** `O(1)` per tap.
- **Used in:** convolution, separable convolution, future morphology.
- **Reference:** OpenCV border-mode definitions; Gonzalez & Woods, “Spatial Filtering”.

---

## 2. Colour spaces

### RGB ↔ HSV
- **What:** Hue/saturation/value decomposition; useful for hue rotation and colour pickers.
- **Formula:** `V = max`, `S = (max−min)/max`, `H` by 60° sector (`0..360`).
- **Inverse:** sector reconstruction `C = V·S`, `X = C·(1−|(H/60 mod 2)−1|)`, `m = V−C`.
- **Complexity:** `O(1)` per pixel.
- **Pros / cons:** intuitive hue control; singular at `S=0` (hue undefined).
- **Used in:** Hue shift, colour chips.
- **Reference:** Gonzalez & Woods — “Color Image Processing”.

### RGB ↔ HSL
- **What:** Alternative hue/chroma/lightness model; lightness is symmetric around 0.5.
- **Formula:** `L = (max+min)/2`, `S = d / (1−|2L−1|)`.
- **Complexity:** `O(1)`.
- **Used in:** future Colour Explorer.
- **Reference:** Gonzalez & Woods — “Color Image Processing”.

### RGB ↔ YCbCr (BT.601)
- **What:** Separates luma from two chroma channels; the basis for luma-only processing.
- **Formula:** `Y = .299R+.587G+.114B`; `Cb = 128 − .168736R − .331264G + .5B`; `Cr = 128 + .5R − .418688G − .081312B`.
- **Complexity:** `O(1)`.
- **Used in:** colour-space teaching, future chroma denoise.
- **Reference:** ITU-R BT.601; Gonzalez & Woods.

### RGB ↔ CIE Lab (D65)
- **What:** Perceptually closer space; used for colour transfer and perceptual distances.
- **Formula:** sRGB → linear → XYZ (D65) → `f(t)` → `L = 116 f(Y/Yn) − 16`, `a = 500(fX−fY)`, `b = 200(fY−fZ)`; inverse reverses the chain.
- **Complexity:** `O(1)` per pixel (pow/cbrt dominate).
- **Pros / cons:** good perceptual uniformity; heavier than HSV.
- **Used in:** planned Colour Transfer (Week 3/4).
- **Reference:** CIE 15:2004; Gonzalez & Woods — “Color Image Processing”.

---

## 3. Point operations

### Brightness
- **Formula:** `out = clamp(in + b)`, `b ∈ [−100, 100]`.
- **Complexity:** `O(N)`.
- **Pros / cons:** trivial and fast; clips highlights/shadows.
- **Used in:** Editor slider, Auto Enhance stage.

### Contrast
- **Formula:** `out = (in − 128)·c + 128`, `c ∈ [0, 3]`.
- **Complexity:** `O(N)`.
- **Pros / cons:** simple S-curve substitute; loses detail at extremes.
- **Used in:** Editor, Enhance Studio.

### Gamma
- **Formula:** `out = 255·(in/255)^(1/γ)`, `γ ∈ [0.2, 5]`.
- **Implementation:** 256-entry LUT per image.
- **Complexity:** `O(N + 256)`.
- **Pros / cons:** lifts shadows without clipping mid-tones; not a true filmic curve.
- **Used in:** Enhance Studio, tone demos.

### Saturation
- **Formula:** `luma = .2126R+.7152G+.0722B`; `out = luma + s·(in−luma)`.
- **Complexity:** `O(N)`.
- **Pros / cons:** preserves luma, `s=0` gives grayscale; can clip highly saturated colours.
- **Used in:** Editor, Creative looks.

### Hue shift
- **What:** Rotate hue in HSV, preserve S/V.
- **Formula:** `H′ = (H + θ) mod 360`.
- **Complexity:** `O(N)` with two conversions per pixel.
- **Pros / cons:** clean hue changes; grayscale pixels are unaffected.
- **Used in:** Creative filters, Colour Explorer.

### Grayscale
- **Formula:** Rec. 709 luma `Y = .2126R+.7152G+.0722B`.
- **Complexity:** `O(N)`.
- **Used in:** Noir, edge-detection input, teaching.

### Sepia
- **Formula:** 3×3 warm matrix, blended by `amount`:
  `R′=.393R+.769G+.189B`, `G′=.349R+.686G+.168B`, `B′=.272R+.534G+.131B`.
- **Complexity:** `O(N)`.
- **Used in:** Creative presets, channel-mixer demo.

### Invert
- **Formula:** `out = 255 − in`.
- **Complexity:** `O(N)`.
- **Used in:** difference views, negative art.

### Channel mixer
- **Formula:** `out = M·in`, `M` a 3×3 matrix (nine params `m00..m22`).
- **Complexity:** `O(N)`.
- **Pros / cons:** covers sepia, cross-processing, white balance in one operation; not constrained to preserve luma.
- **Used in:** Colour Space Explorer, custom looks.

### Duotone
- **Formula:** `t = Y/255`; `out = dark + (light−dark)·t`, endpoints from a fixed palette.
- **Complexity:** `O(N)`.
- **Used in:** Creative launch filters.

### Posterize
- **Formula:** `out = round(in/255·(L−1))/(L−1)·255`, `L ∈ [2, 32]`.
- **Complexity:** `O(N + 256)` via LUT.
- **Used in:** poster art, banding demos.

---

## 4. Spatial filtering

### Convolution
- **What:** Weighted neighbourhood sum; the primitive behind smoothing, sharpening and derivatives.
- **Formula:** `(f ∗ w)(x,y) = Σ_s Σ_t w(s,t)·f(x+s,y+t)`.
- **Complexity:** `O(N·k²)`; borders `O(1)` per tap.
- **Pros / cons:** completely general; cost grows with kernel area.
- **Used in:** sharpen, box/Gaussian blur, Sobel, Laplacian, emboss, LoG.
- **Reference:** Gonzalez & Woods — “Spatial Filtering”.

### Separable convolution
- **What:** Runs a 1-D horizontal kernel then a 1-D vertical kernel while keeping a float intermediate.
- **Formula:** if `w(s,t)=u(s)·v(t)`, compute rows then columns.
- **Complexity:** `O(N·k)` instead of `O(N·k²)`.
- **Pros / cons:** 3–5× faster for Gaussian/box; only valid for separable kernels; one float buffer of `3N`.
- **Used in:** Gaussian blur (Denoise Arena), future Enhance Studio.

### Kernel factories
| Kernel | Weights / formula | Sum | Use |
|---|---|---|---|
| Box `k` | `1/k²` | 1 | mean blur, baseline denoise |
| Gaussian 1-D/2-D | `exp(−r²/2σ²)` normalised | 1 | smooth, scale-space, LoG |
| Sobel x/y | `[-1 0 1; -2 0 2; -1 0 1]` (transpose for y) | 0 | gradient magnitude |
| Prewitt x/y | `[-1 0 1; -1 0 1; -1 0 1]` (transpose) | 0 | cheaper gradient |
| Laplacian 4/8 | `[0 1 0; 1 −4 1; 0 1 0]` / 8-neighbour | 0 | edge energy |
| LoG | `(1−r²/2σ²)·exp(−r²/2σ²)`, mean-subtracted | 0 | blob/edge detection |
| Emboss | directional derivative, zero-sum | 0 | relief look (bias +128 at display) |
| Sharpen | `[0 −1 0; −1 5 −1; 0 −1 0]` | 1 | unsharp-style crispening |

- **Reference:** Gonzalez & Woods — “Spatial Filtering”; Marr & Hildreth (LoG).

---

## 5. Histogram processing

### Histogram
- **What:** Counts R/G/B/luma samples per bin.
- **Formula:** `h(v) = #{pixels with intensity v}`.
- **Complexity:** `O(N + bins)`.
- **Used in:** Histogram Surgery, HUD, QA.

### CDF
- **Formula:** `c(v) = Σ_{u≤v} h(u) / N`, last entry 1.
- **Complexity:** `O(bins)`.
- **Used in:** equalisation, matching.

### Histogram equalisation
- **Formula:** luma mode `out = clamp(in + (round(255·c(Y)) − Y))`; per-channel mode maps each channel through its own CDF.
- **Complexity:** `O(N + bins)`.
- **Pros / cons:** automatic contrast; can over-enhance noise and shift colour in per-channel mode (luma mode preserves hue better).
- **Used in:** Histogram Surgery (Week 3), Enhance Studio.
- **Reference:** Gonzalez & Woods — “Histogram Processing”.

### Tone-curve LUT
- **What:** five control points at inputs `0, 64, 128, 192, 255` are joined by straight segments into a 256-entry map; `applyLut` looks up every RGB channel.
- **Formula:** `out = LUT[in]`, with `LUT[v]` linearly interpolated between the two surrounding control outputs.
- **Complexity:** `O(256)` to build, `O(N)` to apply.
- **Pros / cons:** instant, deterministic and exactly predictable; straight segments can show subtle banding on very smooth gradients, which a monotone spline would remove later.
- **Used in:** Histogram Surgery (Curve), future export pipeline.
- **Reference:** Gonzalez & Woods — “Intensity Transformations”; common photo-editor tone-curve practice.

### Radial frequency mask
- **What:** a mask that depends only on the radial frequency D (cycles per pixel): low-pass keeps D below the cutoff, high-pass keeps D above it, band-pass keeps a ring.
- **Formula:** low-pass `H = D ≤ D0` (hard) or `H = exp(−D²/2D0²)` (soft); high-pass `H = 1 − H_lp`; band-pass `H = exp(−D²/2D_hi²) − exp(−D²/2D_lo²)`.
- **Params:** `mode` (0/1/2), `cutoff` D0 (0.01–0.5), `band` width, `softness` (hard/soft).
- **Complexity:** `O(W·H·log(W·H))` — pad → FFT → multiply mask → inverse FFT → crop.
- **Pros / cons:** the mask *is* the drawing, so the lesson is direct; global statistics mean it cannot be sliced into bands.
- **Used in:** Frequency Playground (Lab screen 4), Trace (`radialMask`).
- **Reference:** Gonzalez & Woods — “Frequency Domain Filtering”.

---

## 6. Noise models

### Seeded PRNG (mulberry32)
- **What:** 32-bit deterministic generator; one seed → identical bytes on every platform.
- **Formula:** integer mixing with `Math.imul`, output `[0,1)`.
- **Complexity:** `O(1)` per sample.
- **Why:** reproducible Denoise Arena comparisons and stable tests.
- **Reference:** mulberry32 (public-domain algorithm).

### Gaussian noise
- **Formula:** `out = clamp(in + σ·N(0,1))`, Box–Muller for normal samples.
- **Params:** `σ ∈ [0, 50]`, integer seed.
- **Complexity:** `O(N)`; three samples per pixel.
- **Pros / cons:** realistic sensor noise; clipping at 0/255 biases the mean at high σ.
- **Used in:** Denoise Arena.

### Salt-and-pepper
- **Formula:** each pixel becomes 255 (salt) with `p/2`, 0 (pepper) with `p/2`, else unchanged.
- **Params:** `p ∈ [0, 0.2]`, seed.
- **Complexity:** `O(N)`.
- **Used in:** median/adaptive-median demos (Week 2).

### Speckle
- **Formula:** `out = clamp(in·(1 + σ·N(0,1)))`.
- **Params:** `σ ∈ [0, 1]`, seed.
- **Complexity:** `O(N)`.
- **Used in:** Denoise Arena (multiplicative noise card).

---

## 7. Quality metrics

### MSE
- **Formula:** `MSE = (1/3N)·Σ(a−b)²` over RGB.
- **Complexity:** `O(N)`.
- **Used in:** Denoise Arena badges.

### PSNR
- **Formula:** `PSNR = 10·log10(255²/MSE)` dB; identical images → `∞`.
- **Complexity:** `O(N)`.
- **Pros / cons:** cheap and ubiquitous; poorly matches perceived quality at high fidelity.
- **Used in:** Denoise Arena.

### SSIM
- **Formula:** on 8×8 luma windows,
  `SSIM = (2μaμb+C1)(2σab+C2) / ((μa²+μb²+C1)(σa²+σb²+C2))`, `C1=(0.01·255)²`, `C2=(0.03·255)²`; report the mean.
- **Complexity:** `O(N)`.
- **Pros / cons:** correlates better with perception than MSE; block-window artefacts and non-local distortions remain.
- **Used in:** Denoise Arena crown, QA.
- **Reference:** Wang, Bovik, Sheikh & Simoncelli (2004) — SSIM paper.

---

## 8. Denoising filters (Week 2)

All five take an explicit `BorderMode` (default `clamp`); `zero` in the mean filter is the classic black-padding variant (weights still divide by `k²`, so edges darken — worth showing in the Lab).

### Moving average (mean filter)
- **Formula:** `out(x,y) = (1/k²)·Σ_{s,t∈W_k} in(x+s, y+t)`; implemented separably (row pass + column pass).
- **Params:** odd `k ∈ [3,9]`.
- **Complexity:** `O(N·k)` separable vs `O(N·k²)` naive.
- **Pros / cons:** cheapest smoother; blurs edges and attenuates high frequencies uniformly.
- **Reference:** Gonzalez & Woods, "Smoothing (Lowpass) Spatial Filters".

### Gaussian filter (discrete)
- **Formula:** separable 1-D taps `g(x) = exp(−x²/2σ²)`, normalised to sum 1; radius `min(10, ⌈3σ⌉)`.
- **Params:** `σ ∈ [0.5,5]`.
- **Complexity:** `O(N·K)`, `K = 2r+1`.
- **Pros / cons:** smoother than the box (no ringing from a hard window); still blurs edges.
- **Reference:** Gonzalez & Woods, "Spatial Filtering".

### Median filter
- **What:** replace each pixel by the median of its `k×k` neighbourhood, per channel.
- **Implementation:** 256-bin histogram slid across the window (increment entering column, decrement leaving); the lower-middle of the two central counts is picked for even windows; bins are restored symmetrically so no drift accumulates.
- **Params:** odd `k ∈ [3,7]`.
- **Complexity:** `O(N·k)` amortised (window histogram update is `O(k)` per step, all bins ≤ 256).
- **Pros / cons:** removes impulse (salt-and-pepper) noise while keeping step edges; fails on gaussian noise beyond moderate σ; can thin thin structures.
- **Reference:** Huang, Yang & Guan, "Fast algorithm for 2-D median filtering" (histogram slide).

### Adaptive median filter
- **What:** median within a `k×k` window that grows (up to 7×7) until the local statistics qualify the pixel as noise (z-min < A1 < z-max); isolated impulses are replaced, already-median pixels pass through.
- **Complexity:** `O(N·k²)` worst case, far less in practice.
- **Pros / cons:** preserves detail a plain median would erode at impulse rates >10 %; heavier cost.
- **Reference:** Gonzalez & Woods, "Adaptive median filter".

### Bilateral filter
- **Formula:** `out = Σ ws·wr·in / Σ ws·wr`, `ws = exp(−(s²+t²)/2σs²)`, `wr = exp(−ΔI²/2σr²)` with `ΔI` on Rec.709 luma.
- **Params:** `σs ∈ [1,10]` → radius `clamp(round(σs),1,5)`; `σr ∈ [10,100]`.
- **Complexity:** `O(N·k²)`.
- **Pros / cons:** smooths flat regions while *preserving edges* (range term refuses to average across large luma jumps); not edge-preserving on texture as strong as the edges; cost grows with radius.
- **Reference:** Tomasi & Manduchi, "Bilateral Filtering for Gray and Color Images" (1998).

---

## 9. Enhancement & sharpening (Week 2)

### Linear stretch / auto levels
- **Stretch:** piecewise map `[blackPoint,whitePoint] → [0,255]` (identity outside); computed from the RGB min/max.
- **Auto levels:** black/white points at the 0.5/99.5 percentiles of the luma histogram, then the same piecewise map per channel-independent luma stretch.
- **Complexity:** stretch `O(N)`; auto levels `O(N + L)` (histogram first).
- **Note:** these run **globally** (no halo) — per-band min/max would differ per band.

### CLAHE (contrast-limited adaptive histogram equalisation)
- **What:** the image is split into a tile grid (snapped to 4/8/16 per side), each tile equalises against its own clipped histogram, and the per-tile luma LUTs are blended bilinearly per pixel so no tile seams appear.
- **Clip limit:** real-valued `limit·area` redistribution — bins above the limit share their excess uniformly.
- **Complexity:** `O(N + T·L)`.
- **Pros / cons:** local contrast without the flat-region noise blow-up of global equalisation; still amplifies noise at high limits.
- **Reference:** Pizer et al., "Contrast limited adaptive histogram equalisation" (1987).

### Unsharp mask
- **Formula:** `out = in + amount·(in − gaussianBlur(in, σ))`, optional threshold on the detail layer; the blur radius uses the gaussian rule above.
- **Params:** `amount ∈ [0,3]`, `σ ∈ [0.5,3]`, `threshold ∈ [0,64]`.
- **Complexity:** `O(N·K)`.
- **Pros / cons:** controllable sharpening with a threshold that protects flat areas from noise amplification.
- **Reference:** Gonzalez & Woods, "Sharpening (Highpass) Spatial Filters".

### Laplacian sharpening
- **Formula:** `out = in − ∇²in` with the 4-neighbour Laplacian `[0,1,0; 1,−4,1; 0,1,0]`, computed inline (signed!) — the generic `convolve` clamps negatives, so the signed response must not pass through it.
- **Complexity:** `O(N)`.
- **Reference:** Gonzalez & Woods, "Laplacian of Gaussian"; Marr & Hildreth (1980).

### Gray-world / white-patch white balance
- **Gray-world:** per-channel gain `g_c = gray / mean_c` where `gray` is the mean of all channel means — assumes the scene averages to neutral.
- **White-patch:** per-channel gain `g_c = 255 / max_c` over the brightest patch — assumes the brightest surface is white.
- Both clamp gains to a sane band and blend by `strength`; **global statistics → global (non-banded) execution**.

---

## 10. Edge detection (Week 2)

### Sobel / Prewitt
- **Formula:** `Gx`, `Gy` via the two axis kernels (Sobel weights `[1,2,1]` smooth along the axis; Prewitt uses `[1,1,1]`); gradients computed on **Rec.709 luma** with signed inline passes.
- **Magnitude:** `|G| = hypot(Gx,Gy)`, normalised by `maxSum·√2` (4 for Sobel, 3 for Prewitt) so a full black→white step maps to 180 on both operators.
- **Complexity:** `O(N)` (two signed passes).
- **Reference:** Gonzalez & Woods, "Gradient" (first-order derivatives).

### Canny
- **Stages** (exposed via `cannyStages` for the Lab): gaussian blur → gradient magnitude → non-maximum suppression → hysteresis.
- **NMS:** keep a pixel only if its magnitude is ≥ both neighbours along the gradient direction (ties keep both columns).
- **Thresholds:** relative to the maximum magnitude (strong `tH`, weak `tL = tH/2`); a flat image returns an all-black edge map.
- **Hysteresis:** stack flood fill from strong pixels through weak ones (flags 0/1/2/3).
- **Complexity:** `O(N)`.
- **Reference:** Canny, "A Computational Approach to Edge Detection" (1986).

---

## 11. Frequency domain (Week 2)

### FFT (radix-2, in-place)
- **What:** iterative in-place Cooley–Tukey on bit-reversed order, decimation-in-frequency; `fft2d` runs rows via subarray views plus a column scratch buffer. Images are zero-padded to the next power of two; inverse + round-trip tested to ±1e-9.
- **Complexity:** `O(P·log P)`, `P = nextPow2(W)·nextPow2(H)`.
- **Reference:** Oppenheim & Schafer, *Discrete-Time Signal Processing*.

### Ideal / Gaussian / Butterworth masks
- **Distance:** `D = hypot(u',v')/w₂` in cycles/pixel (0.5 = Nyquist), with `fftShift` putting DC at the centre.
- **Low-pass:** ideal `D ≤ D₀`; gaussian `exp(−D²/2D₀²)`; butterworth `1/(1+(D/D₀)^{2n})`.
- **High-pass:** `1 − lowPass`; **band-pass:** difference of two gaussian low-passes; band-reject is its complement.
- Each channel is filtered independently, then cropped back to the original dimensions. Masks run per-pixel → banded with a small halo (the blur radius of the mask).
- **Complexity:** `O(P·log P)` + `O(P)` per channel.
- **Reference:** Gonzalez & Woods, "Frequency Domain Filtering".

### Spectrum image
- **What:** `log(1 + |fftShift(FFT)|)` normalised to 0..255 — the teaching visual for the Frequency Playground screen; returns the pow2-padded dimensions by design.
- **Params:** `gain` (1–8), `smooth` (1 = 3×3 box average over the magnitude plane, which turns single-pixel salt into readable structure), `gamma` (curve on the normalised magnitude; < 1 lifts the faint bins so the picture reads as a spectrum).

---

## 12. Execution policy — banded processing (Week 2)

- **What:** heavy operations run in row bands (`DEFAULT_BAND_ROWS = 32`) through `runOperationAsync`, yielding to the scheduler between bands so the UI thread breathes.
- **Halo:** each registry op may declare `halo(params)` — extra rows above/below a band the op needs for exact results; the executor slices the exact halo region, so banded output is **bit-identical** to a whole-image run (tested for all banded ops).
- **Global ops:** operations whose result depends on whole-image statistics (histograms, CLAHE, FFT, canny hysteresis, seeded-noise scan order, auto levels, gray-world, white-patch) declare no halo and run in one pass.
- **Scheduler:** `src/core/worker.ts` `nextFrame()` (rAF, macrotask fallback) is the single adaptation point for a future worklet runtime.
- **Reference:** the classic tiled-processing pattern from graphics engines (halo exchange).

---

## 13. Creative mode filters (Week 3)

All six are pure, deterministic engine operations (`src/engine/creative/filters.ts`),
so the same look is reachable from Creative mode, the editor and the export
path. They work on luminance and never paint the UI, which keeps the chrome
monochrome while the photo carries the effect.

| Filter | Idea | Formula / method | Complexity |
|---|---|---|---|
| **Aurora** | soft light streaks | `out = in + max(0, sin(2π·bands·x + bend(y)))³·strength` | `O(N)` |
| **Liquid** | domain warping | sample at `(x + sin(y·s)·k, y + cos(x·s)·k)` (bilinear) | `O(N)` |
| **Vortex** | swirl around the centre | `θ(r) = (1 − r/rmax)²·strength·3.2` | `O(N)` |
| **Glitch** | block displacement | `out(x,y) = in(x + shift(block), y)`, seeded PRNG | `O(N)` |
| **Duotone** | two-stop ramp | `out = shadow + (light − shadow)·Y^0.92` | `O(N)` |
| **Noir** | high-contrast grey + vignette | `(Y − 0.5)·contrast + 0.5`, then `·(1 − vignette·r²)` | `O(N)` |

- **Pros / cons:** each filter is one idea a child can name ("add light", "make
  it flow", "twist it", "break it", "two colours", "film"); the price is that
  they are CPU passes, so Creative mode renders on a 512 px proxy instead of
  running as SkSL shaders on the GPU (the shader twins are still open).
- **Used in:** the engine catalogue only — the Creative mode screen was removed by the owner (2026-10-21), so these six are documented algorithms without a UI for now.
- **Reference:** classic computer-graphics warps and photo treatments; the
  grayscale/luma pipeline follows Gonzalez & Woods — “Image Fundamentals”.

---

## 14. Facade and parameter safety

### Registry + `runOperation`
- **What:** One catalogue of operations, each with numeric `ParamDef`s, explanation text and cost tier. `runOperation(id, src, params)` merges defaults, clamps to `[min,max]`, drops unknown keys, then runs the pure function.
- **Why:** sliders and shaders can never feed out-of-range values into an algorithm; Explain sheets stay in sync with code.
- **Complexity:** `O(#params)` overhead.
- **Used in:** every UI entry point.

---

## 15. References (no copied text)

- Rafael C. Gonzalez & Richard E. Woods, *Digital Image Processing* — image fundamentals, intensity transformations, spatial filtering, colour, histogram processing, noise models.
- ITU-R BT.601 — luma/chroma matrix.
- CIE 15:2004 — Lab colour space.
- Wang, Bovik, Sheikh & Simoncelli, “Image Quality Assessment: From Error Visibility to Structural Similarity” (2004).
- OpenCV documentation — border modes and morphological definitions.
- Marr & Hildreth (1980) — Laplacian of Gaussian.
