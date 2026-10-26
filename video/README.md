# MorphLens — Algorithm Theatre reel

A vertical (1080×1920) Remotion reel that explains the three photo modes of
**MorphLens** — *brightness*, *contrast* and *sharpen* — by zooming into one
real photo, showing the pixel addresses and channel values behind it, and
running the app's own mathematics on screen.

**The style comes from five reference reels** in `/home/dev/Video refrences`
— all five carry the same weight, and the common denominator of them is
written down in `docs/REEL_STYLE.md`. In short: a warm paper page, one visual
floating in a card at a time, a short **Arabic** headline with a single word in
one warm accent, a grey second line, and a camera that keeps moving inside
the card. Every movement has a sound; there is no music and no voiceover.

Every number in the video is produced by the app's engine
(`src/engine/**`), not typed in by hand: `scripts/build-assets.ts` runs the
real `brightness`, `contrast`, `gaussianFilter` and `unsharpMask` passes over
the source photo and writes both the frames and `public/frames/data.json`.

---

## 0. The three reels

| Reel | Composition | Length | What it explains |
|---|---|---|---|
| `morphlens_lab_reel.mp4` | `MorphLensReel` | 60.3 s | brightness · contrast · sharpen |
| `morphlens_denoise_reel.mp4` | `MorphLensDenoiseReel` | 48.8 s | the **median filter** — salt & pepper noise, the 3×3 window, the median, PSNR/SSIM |
| `morphlens_showreel.mp4` | `MorphLensShowreel` | 38.5 s | the **modern showreel** — 7 fast cuts, 4 photographs, a dark treatment, the numbers counting, the before/after wiped on screen |

Both are in the house style of the reference reels (`docs/REEL_STYLE.md`),
Arabic-first, with the numbers produced by the app's own engine.

## 1. Quick start

```bash
cd video
npm install                 # remotion 4.0.537, react 19, tsx, pngjs
npm run assets              # rebuild public/frames/* from the app engine + the SFX
npm run assets:denoise      # the median filter's frames + numbers
npm run studio              # preview in the Remotion Studio
npm run render              # full 1080×1920 render (NVIDIA EGL + NVENC)
```

Outputs:

| File | What it is |
|---|---|
| `output/morphlens_lab_reel.mp4` | The reel — H.264 / yuv420p / 30 fps / 1080×1920 / 1808 frames / 60.3 s, with an AAC 48 kHz stereo sound track |
| `output/morphlens_lab_reel_thumbnail.png` | Platform thumbnail (its own composition) |
| `output/morphlens_denoise_reel.mp4` | **The second reel** — the median filter (`npm run render:denoise`) |
| `output/morphlens_denoise_thumbnail.png` | Its thumbnail (`npm run still:denoise`) |
| `output/morphlens_showreel.mp4` | **The modern showreel** — 7 fast shots, 4 photos, dark (`npm run render:showreel`) |
| `output/morphlens_showreel_thumbnail.png` | Its thumbnail (`npm run still:showreel`) |
| `output/morphlens_showreel_thumbnail.png` | Its thumbnail (`npm run still:showreel`) |
| `output/preview.mp4` | Fast low-res proof (`npm run render:preview`) |

## 2. GPU (the brief requires the NVIDIA card)

Rendering and encoding both run on the RTX 2050, never on the CPU:

| Stage | Setting | Result |
|---|---|---|
| Chrome rasterisation | `--gl=egl` (`Config.setChromiumOpenGlRenderer('egl')`) | Chromium composites on `libEGL_nvidia` — the GPU does the pixels |
| H.264 encoding | `--hardware-acceleration=if-possible` | Remotion's bundled FFmpeg picks `h264_nvenc` (confirmed in the render log: `Encoder: h264_nvenc, hardware accelerated: true`) |
| Parallelism | `--enable-multiprocess-on-linux --concurrency=50%` | 6 worker processes on this box |

NVENC and Remotion's `--crf` are mutually exclusive, so quality is set with a
target bitrate (`Config.setVideoBitrate('12M')`; the file lands at ≈6 Mbps).
Do **not** re-add `Config.setCrf(...)` — it silently disables the hardware
encoder and falls back to `libx264`.

Check the GPU is doing the work while rendering:

```bash
watch -n 1 nvidia-smi
```

## 3. Scenes (time-coded, Arabic)

| # | Frames | Time | What happens |
|---|---|---|---|
| 1 | 0–134 | 0.0–4.5 s | **Chapter card** (`MORPHLENS` / مختبر الصور), then the photo card pushes in on the ant. Caption: *كل صورة أرقام* |
| 2 | 111–427 | 3.7–14.3 s | **Pixels** — the camera pushes into the ant's leg, the 16×16 window opens over it, the values type in cell by cell, one cell is singled out. Caption: *كبّرنا 16×16 بكسل* |
| 3 | 404–855 | 13.5–28.5 s | **Step 01/03 — السطوع** — the real pixel 94 → 134 through the arrow, the picture brightens inside its card, the 64-bin histogram morphs. Caption: *السطوع: رقم واحد على كل بكسل* |
| 4 | 832–1113 | 27.7–37.1 s | **Step 02/03 — التباين** — the camera pulls back to the whole plant while the transfer curve draws itself against the identity diagonal. Caption: *التباين: الوسط ما بيتحركش* |
| 5 | 1090–1581 | 36.3–52.7 s | **Step 03/03 — الحدّة** — a 3×3 window slides over the pixels, the real pipeline is staged on the photo (original → ناعم → التفاصيل → الحدّة) and the arithmetic arrives one line at a time |
| 6 | 1558–1807 | 51.9–60.3 s | **End card** — *اكتب «PHOTO» في التعليقات*, the dark pill button, and the photo still drifting behind |

Scenes overlap by 24 frames so every change is a cross-fade on the photo —
there is no cut to black and no white flash anywhere in the reel (verified
frame by frame, see `QA.md`).

## 3b. The sound

There is no voiceover and no music: the guide forbids inventing narration and
forbids background music. The motion itself is voiced by seven **synthesised**
SFX — generated from scratch by `scripts/build-sfx.ts` (plain maths, no
samples, nothing to license):

| Sound | Built from | Where it lands |
|---|---|---|
| `whoosh` | filtered noise, 400 Hz → 6 kHz → 700 Hz | the photo pushing in, the window opening, every scene change, the photo being re-processed |
| `pop` | 720 Hz blip with a click transient | the 16×16 mark, a value landing, the result chip, the maths lines |
| `click` | 2.6 kHz noise tick | the mode chips, the 3×3 kernel window |
| `thump` | 86 Hz sine + low noise | the moment a result lands |
| `tick` / `ratchet` | 1.5–2.1 kHz micro-click | the 256 pixel values typing in |
| `sweep` | rising 240 → 1.1 kHz tone under a noise sweep | the transfer curve being drawn, each sharpening stage advancing |
| `zoomin` | noise 300 Hz → 5.5 kHz with a rising 120 → 900 Hz tone bed (2.6 s) | every camera push-in |
| `zoomout` | the same in reverse, 5.2 kHz → 600 Hz, falling tone (2.8 s) | every camera pull-back |
| `dolly` | soft low noise bed (2 s) | a long, slow camera move |

Every file is peak-normalised to −0.7 dBFS and the mix is checked for
clipping (peak −10.5 dBFS in the final render, zero clipped samples). The
sounds sit on the **same frames as the movement they describe** — the
envelope of the exported audio was measured to confirm it.

## 4. Where the pixels come from

`npm run assets` (i.e. `scripts/build-assets.ts`):

1. reads `public/frames/hero.png` (960×1440),
2. runs the app engine: `brightness(+40)`, `contrast(×1.3)`, `gaussianFilter(σ 1.4)`,
   `unsharpMask(amount 1.2, radius 1.4)` and the same signed difference map the
   app's Trace screen uses,
3. writes `hero_bright.png`, `hero_contrast.png`, `hero_blur.png`,
   `hero_detail.png`, `hero_sharp.png`, the native 16×16 crops
   (`crop*.png`) and `data.json` (addresses, values, probe pixel, histograms).

Swap the photo and the whole reel follows: drop a new `hero.png` (960×1440)
into `public/frames/`, run `npm run assets`, re-render. The storyboard picks
up the new numbers automatically.

## 4b. The camera

Every scene declares a camera and the photo is rendered through it, so the
reel reads as one continuous shoot of one photograph:

The photo always lives **inside a card**, and the camera moves *inside* the
card. `cameraForCard()` computes the framing so the picture always covers
the card (with 16 % of slack, so the camera can also drift), and `pointOn()`
returns where a source pixel lands on the frame, so every overlay stays glued
to the picture while the lens moves.

| Shot | Camera | Sound |
|---|---|---|
| Hook | push in on the ant | `sweep` … `whoosh` |
| Pixels | push into the ant's leg, then pull back out | `zoomin` … `zoomout` |
| Brightness | a slow drift down the stem, with a punch-in when the picture changes | `zoomin` |
| Contrast | pull all the way back to the whole plant, then drift | `zoomout` … `zoomin` |
| Sharpen | push into the ant's head, then pull back out | `zoomin` … `zoomout` |
| End card | a slow drift behind the card | — |

## 4c. The twenty effects

`docs/REEL_EFFECTS.md` is the catalogue: all twenty effects, what each one
does, and the beat it is used on. They live in `src/effects/index.tsx` as
frame-driven components — no CSS keyframes, no timers.

## 5. Design rules this reel follows

- The app's own design system (`docs/design.md`): light-first monochrome —
  paper `#F6F5F1`, ink `#141412`, graphite `#4E4D48`; hairline strokes, no
  drop shadows, no second accent hue.
- The app's own fonts, loaded from `public/fonts` (copied from
  `@expo-google-fonts`): Space Grotesk 600/700, Inter 400/500/600,
  JetBrains Mono 500. Numbers are always mono and tabular.
- Chrome stays monochrome; the photo carries the colour.
- Captions sit inside the platform-safe area (72 px sides, 150 px top,
  280 px bottom).
- No background music, no voiceover (none was supplied) — the captions carry
  the narration, and the motion is frame-accurate.

### Gotchas learned the hard way (do not undo these)

- **React DOM treats a numeric `lineHeight` as a unitless multiplier.**
  `lineHeight: 32` becomes 32 × font-size and every block blows up to ~740 px.
  The tokens in `src/styles/tokens.ts` therefore use `'32px'` strings.
- Give every absolutely positioned flex row an **explicit height**; an
  auto-height item in an absolutely positioned row can be stretched by the
  compositor before the webfonts land (the chip became a 750 px stadium).
- Use Remotion's `<Img>` (it waits for the image) and `staticFile()` for
  asset paths — a relative `src` 404s inside the player.
- `font-display: swap` + a `delayRender` on `document.fonts.ready` keeps the
  fallback serif out of the rendered frames.

## 6. Files

```
video/
  remotion.config.ts        GPU + encoder settings
  scripts/build-assets.ts   runs the app engine, writes frames + data.json
  scripts/build-assets-denoise.ts  the median reel's frames + metrics
  scripts/build-assets-showreel.ts the showreel's photos, engine passes and 12×8 matrices
  scripts/build-sfx.ts      synthesises the seven motion sounds
  src/DenoiseReel.tsx       the median filter reel's timeline
  src/scenes/Denoise.tsx    its four scenes
  src/ShowreelTimeline.tsx  the modern showreel's cut list
  src/scenes/Showreel.tsx   its seven shots
  src/components/Modern.tsx the dark kit: number matrix, before/after, glass, kinetic type
  src/effects/index.tsx   the twenty video effects (see docs/REEL_EFFECTS.md)
  src/styles/dark.ts        the showreel's tokens
  src/
    Root.tsx                the two compositions (reel + thumbnail)
    Reel.tsx                the scene timeline
    Thumbnail.tsx           the platform thumbnail
    components/Chrome.tsx   page, panel, chip, caption, mono card, slider, scrim
    components/Graphics.tsx arrow, pixel window, histogram, transfer curve, kernel
    scenes/                 Hook, Pixels, Brightness, Contrast, Sharpen, Outro
    styles/tokens.ts        the app's design tokens, scaled to 1080 wide
    styles/fonts.ts         the app's faces, loaded from public/fonts
    lib/data.ts             the baked numbers (data.json)
  public/frames/            hero + processed frames + data.json
  public/sfx/               the seven generated sounds
  public/fonts/             Space Grotesk, Inter, JetBrains Mono
  output/                   the rendered videos and thumbnails
  storyboard.md             the Lab reel's time-coded storyboard
  storyboard-denoise.md     the median reel's time-coded storyboard
  QA.md                     what was verified, and what was not
```

## 7. Credits

Photo: **“Ant on a golden club”** by *Rhododendrites*, CC BY-SA 4.0 —
<https://commons.wikimedia.org/wiki/File:Ant_on_golden_club_(24749).jpg>.
The reel is a non-commercial explainer of an open-source project and credits
the photographer on the end card.
