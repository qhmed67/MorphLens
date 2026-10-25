# Storyboard — MorphLens · the median filter reel

**Composition** `MorphLensDenoiseReel` · 1080×1920 · 30 fps · 1464 frames · 48.8 s
**Voiceover** none (none supplied — the Arabic captions carry it, no music)
**Sound** the same seven synthesised SFX on the motion beats
**Style** `docs/REEL_STYLE.md` — the common denominator of the five reference reels
**Language** Arabic (the copy is the app's own, from `src/lab/arabicExplain.ts`)
**Source of every number** `public/frames/denoise/denoise.json`, produced by the app engine

---

## Scene 1 — Chapter + the noise · frames 0–210 (0.0–7.0 s)

| Frames | Action |
|---|---|
| 0–46 | The dark chapter card: `MEDIAN` / **الميديان**, with the sunburst motif. |
| 60–96 | The photo card rises (tilted −1.5°); the camera drifts down the stem. |
| 96–126 | **The picture changes**: real salt & pepper noise (p = 5 %, seed 7) fades in over the clean frame — 58,376 pixels turn pure black or pure white. |
| 70– | Caption: *الصورة فيها **تشويش*** / "58,376 بكسل اتغيّروا فجأة لأبيض أو أسود (5.1%)." |

## Scene 2 — The 3×3 window · frames 198–648 (6.6–21.6 s)

| Frames | Action |
|---|---|
| 198–204 | The magnified window opens: the 3×3 neighbourhood around one salt pixel, **one magnified cell = one pixel**. |
| 238–292 | The nine luma values type in, one by one, each sitting on the pixel it describes. The outlier (`0`) is boxed in the accent. |
| 308–338 | The nine values sort into a row; the fifth — **the median** — is picked out in the accent: `0 · 36 · 123 · 186 · **223** · 226 · 229 · 243 · 245`. |
| 348– | The result lands: `223`. |
| 228– | Caption: *الم**يديان**: الرقم اللي في النص* / "النقطة الشاذة (أبيض/أسود) مش هتكون في النص — عشان كده هي اللي بتتشال." |

## Scene 3 — Mean vs median · frames 636–1096 (21.2–36.5 s)

| Frames | Action |
|---|---|
| 636–654 | The **mean** filter's result card, left. Under it: المتوسط — `PSNR 26.0 dB`. |
| 654–672 | The **median** filter's result card, right. Under it: الميديان — `PSNR 38.0 dB`. |
| 746–776 | The numbers, end to end: `17.4 dB → 38.0 dB`. |
| 786– | Caption: *الم**توسط** كان بيحسب الوسط* / "فبيمسح الحواف مع التشويش. الميديان بيشيل التشويش بس ويفوّظ الحافة." |

## Scene 4 — The result + the CTA · frames 1084–1464 (36.1–48.8 s)

| Frames | Action |
|---|---|
| 1084– | The cleaned photo card, the camera still drifting. |
| 1114–1144 | The metrics: `PSNR 38.0 dB` and `SSIM 0.976`. |
| 1144– | The headline: *تشويش راح **والحافة مكانتش***, the dark pill button, and *اكتب «MEDIAN» في التعليقات*. |

---

## The numbers in the reel (all from the engine)

| Claim | Engine value |
|---|---|
| 58,376 pixels changed (5.1 %) | `noiseSaltPepper(hero, {probability: 0.05, seed: 7})` |
| The 3×3 window | `0 · 36 · 123 · 186 · 223 · 226 · 229 · 243 · 245` |
| The median | `223` |
| The mean (the same nine) | `168` |
| PSNR noisy → median | `17.35 dB` → `38.02 dB` |
| PSNR mean filter | `26.01 dB` |
| SSIM noisy → median | `0.187` → `0.976` |
