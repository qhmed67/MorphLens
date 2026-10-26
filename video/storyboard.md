# Storyboard — MorphLens · Algorithm Theatre reel

**Composition** `MorphLensReel` · 1080×1920 · 30 fps · 1808 frames · 60.3 s
**Voiceover** none (none supplied — captions carry the narration, no music)
**Sound** seven synthesised SFX on the motion beats (`scripts/build-sfx.ts`)
**Photo** “Ant on a golden club” by Rhododendrites, CC BY-SA 4.0
**Source of every number** `video/public/frames/data.json`, produced by the app engine
**Style** `docs/REEL_STYLE.md` — the common denominator of the five reference reels
**Language** Arabic (the copy is the app's own, from `src/lab/arabicExplain.ts`)

Scene boundaries overlap by 24 frames (twice the 14-frame fade): the outgoing
scene is fading out while the incoming one is already fading in, so the reel
never cuts to black and never flashes to paper.

---

## Scene 1 — Hook · frames 0–135 (0.0–4.5 s)

| Frames | Action |
|---|---|
| 0–16 | Full-bleed photo, slow push-in (scale 1.00 → 1.16). Paper-white chrome fades in: wordmark *MorphLens*, chip *Algorithm Theatre*. |
| 16–44 | Caption springs in: **“A photo is just a grid of numbers.”** |
| 44–78 | Mono card: `960 × 1440 pixels · 3 numbers each · 0…255`. |
| 78–135 | A 140 px window frame pops onto the ant's leg — the 16×16 region the reel will zoom into. |

## Scene 2 — Pixels · frames 111–427 (3.7–14.3 s)

| Frames | Action |
|---|---|
| 123–168 | The photo settles back to its cover position (scale 1.16 → 1.00); a paper veil dims it by 34 %. |
| 141–221 | The 16×16 pixel window grows over the marked region (700 px, nearest-neighbour so every pixel stays square). |
| 195–221 | The red channel of all 256 cells types in, cell by cell. |
| 240–275 | The address row appears above the window (`x` = 406, 410, 414, 418 …). |
| 275–428 | One cell is boxed and tagged: **(412, 455)**. Mono card: `address (412, 455) → R 77 · G 27 · B 0`. Caption: **“Every pixel has an address and three numbers.”** |

## Scene 3 — Mode 1 · Brightness · frames 404–855 (13.5–28.5 s)

| Frames | Action |
|---|---|
| 428–500 | Chip *Mode 1 · Brightness*; the photo dims to 22 %. |
| 454–530 | The pixel window reappears (470 px) with cell (412, 455) boxed. |
| 488–530 | Label *one pixel, one rule*; the formula types itself: `out = clamp(in + b)`. |
| 528–560 | The arithmetic lands: **77 R + 40 = 117 R** (the 117 counts up). |
| 603–678 | The **photo changes**: the real `brightness(+40)` frame crossfades in while the Brightness slider runs 0 → +40. |
| 663–868 | The 64-bin luma histogram morphs from the original curve to the brightened one. Caption: **“One constant, every pixel. That is exposure — not detail.”** |

## Scene 4 — Mode 2 · Contrast · frames 832–1113 (27.7–37.1 s)

| Frames | Action |
|---|---|
| 868–925 | Chip *Mode 2 · Contrast*; the transfer-curve panel slides in on paper. |
| 904–1010 | The curve draws itself, live: `out = (in − 128)·c + 128` with `c` rising 1.00 → 1.30. The identity diagonal stays as a dashed reference. |
| 930–1010 | The operating point is marked: `36 → 12` (the darkest pixel in the window, pushed further from mid-grey). |
| 978–1053 | The **photo changes**: the real `contrast(×1.3)` frame crossfades in with the Contrast slider. |
| 1043–1138 | Caption: **“Mid-grey (128) never moves. Everything else slides away from it.”** |

## Scene 5 — Mode 3 · Sharpen · frames 1090–1581 (36.3–52.7 s)

| Frames | Action |
|---|---|
| 1138–1200 | Chip *Mode 3 · Sharpen*; the stage card appears: *stage 01 / 04 — Original*. |
| 1178–1258 | A 3×3 kernel window (gaussian weights) slides across the magnified pixels; the pixel numbers dim under it. |
| 1256–1388 | The **photo changes** through the real pipeline, one shared stage position driving the cross-fade exactly like the app's Trace screen: *Original → Low-pass (σ = 1.4) → Detail layer (in − blur) → Sharpened*. |
| 1388–1520 | The arithmetic on one real pixel (417, 455): `in R 190` → `blur R 166` → `detail = 190 − 166 = 24` → `out = 190 + 1.2×24 = 219`. |
| 1468–1533 | The Sharpening slider runs 0 → 1.20. |
| 1528–1618 | Caption: **“Edges gain contrast, flat areas stay quiet — push too far and the highlight clips. That is the halo.”** |

## Scene 6 — End card · frames 1558–1807 (51.9–60.3 s)

| Frames | Action |
|---|---|
| 1624–1700 | The app's own editor chrome rises: photo canvas, the *Unsharp mask · 1.2* badge, the operation chips, and the Trace panel with its **Maths / Code / عربي** tabs. |
| 1624–1700 | Inside the Maths tab: `out = in + amount·(in − blur(in))` and `pixel (417, 455): 190 → 219`. |
| 1713–1828 | The call to action: **“See the maths on your photo.”** + *MorphLens · Algorithm Theatre — brightness, contrast, sharpen* + the photo credit. |

---

## The camera plan (the photo lives inside a card; the lens moves inside it)

The photo is never a static background. Each scene has its own framing and
its own move, and the sound of the move (`zoomin` / `zoomout` / `dolly`) is
played on the frame the move starts:

| Scene | Framing | Move |
|---|---|---|
| Hook | the ant, in a card | push in |
| Pixels | the ant's leg, magnified in a second card | push in, then pull back out |
| Brightness | the stem | drift down, punch in when the picture changes |
| Contrast | the whole plant | pull all the way back, then drift |
| Sharpen | the ant's head | push in, then pull back out |
| End card | the plant behind the card | slow drift |

## The rule this storyboard follows

**Nothing sits still and nothing shouts.** There are no title cards, no
section headers and no bullet lists:

- captions arrive **word by word** and leave again (2–6 words per beat);
- the numbers are the graphic — a value flies out of its pixel cell, an arrow
  carries it through `+40`, and the result lands beside it;
- the stage name in the sharpen scene is a small **tag that rides in and out**
  with the stage it names, not a heading;
- the arithmetic arrives **one line at a time** and then gets out of the way;
- every one of those movements has a sound on the same frame.

## Shot list of the explainer motions

The brief asked for one grammar, repeated for every mode:

1. **Zoom in** — the photo pushes in, the marked window grows into the magnified pixel field.
2. **Numbers and addresses** — the grid, the addresses, the channel values, all from the real file.
3. **The arrow of the mathematics** — the formula card, the operand cards, the result.
4. **The photo changes** — the processed frame crossfades in while the slider moves.
5. **The explainer motion that says *why*** — the histogram morph (brightness), the transfer curve (contrast), the staged pipeline (sharpen), each one naming the reason in a single caption.
