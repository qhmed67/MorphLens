# REEL EFFECTS — the twenty

> The effect list this project draws from, extracted from the reference
> ("20 Video Effects Created by Claude") and rebuilt as frame-driven Remotion
> components in `video/src/effects/index.tsx`.
>
> **The reel is light, never dark.** The owner is explicit about it, so the
page is the same warm paper the five references use (`#EFEDE4`), the ink is
the app's ink, and the one accent is the house coral. What makes the reel
modern is the *motion* — the cuts, the effects, the numbers that move — not a
dark background.

**They are a menu, not a costume.** No shot uses more than one at a time;
> every effect is assigned to a specific beat in a specific reel, and the
> assignment is listed below so the reel never turns into a demo reel.

## How to use them

**The showreel was cut back.** After the first version the owner's note was
that the shot was full of complications: the copy turned to mush and the
numbers could not be read. So every shot in `MorphLensShowreel` is now
**one photograph, one big number, one caption** — the second and third panels
(the second matrix, the histogram, the stats row) are gone, and the numbers
that stayed were enlarged (76 → 122 px cells, 96 → 150-172 px counters). All
twenty effects are still in use across the two reels; they just carry fewer
panels each.

```tsx
import { SnapZoom, DollyZoom, PhoneMockup } from '../effects';

<ShowSomething>
  <SnapZoom to={1.4} delay={6}>
    <Img src={...} />
  </SnapZoom>
</ShowSomething>
```

Every effect is a pure function of the frame: no CSS keyframes, no timers, no
`setTimeout`. All of them work over both the dark showreel and the light
house-style reels.

---

## The catalogue

| # | Effect | What it does | Where it is used | Component |
|---|---|---|---|---|
| 01 | **Orbit** | The subject swings around the lens on a shallow 3D arc. | `MorphLensShowreel` — shot 05 (الحدّة): the facade orbits while the sharpened pass flies over it | `Orbit` |
| 02 | **Chat Takeover** | A message bubble slides in and hijacks the frame. | `MorphLensShowreel` — shot 07 (the CTA): the app "says" the keyword | `ChatTakeover` |
| 03 | **Frame Escape** | The picture grows past the edges and breaks out of the frame. | `MorphLensShowreel` — shot 01: the ant escapes from a card to full bleed | `FrameEscape` |
| 04 | **Snap Zoom** | A hard eight-frame punch that lands and holds. | `MorphLensShowreel` — shot 02 (السطوع): the punch into the neon sign | `SnapZoom` |
| 05 | **Checklist Pop** | Items pop in one by one, each with a tick. | `MorphLensShowreel` — shot 03 (الأرقام): sixteen digits count up, then the checklist ticks | `ChecklistPop` |
| 06 | **Headline Stop** | The headline slams in, overshoots a hair and holds. | `MorphLensShowreel` — shot 01: the title slams and holds | `HeadlineStop` |
| 07 | **Zoom Portal** | A circular mask opens and reveals a second layer. | `MorphLensShowreel` — shot 04 (التباين): the portal from before to after | `ZoomPortal` |
| 08 | **Growth Curve** | A curve draws itself and the shape grows out of it. | `MorphLensShowreel` — shot 02: the transfer curve draws itself under the number | `GrowthCurve` |
| 09 | **Studio Reveal** | The frame is revealed like a studio backdrop rolling away. | `MorphLensDenoiseReel` — the curtain lifts off the noisy picture as the chapter card leaves | `StudioReveal` |
| 10 | **B-roll Overlay** | A second layer sits over the first, blended. | `MorphLensShowreel` — shot 05: the sharpened pass over the original | `BrollOverlay` |
| 11 | **Paper Cutout** | Layered paper strips slide in and stack. | `MorphLensDenoiseReel` — the nine neighbour values as paper slips | `PaperCutout` |
| 12 | **Dolly Zoom** | The Vertigo move: the background zooms, the subject stays the same size. | `MorphLensShowreel` — shot 01: the building rushes in behind the ant, which holds still | `DollyZoom` |
| 13 | **Magazine Cover** | The frame becomes a cover: masthead, headline, barcode. | `MorphLensShowreel` — shot 06: the three results as a magazine cover | `MagazineCover` |
| 14 | **Liquid Glass** | A glass panel with a specular highlight that sweeps across. | `MorphLensShowreel` — shot 07: the app UI inside a glass panel | `LiquidGlass` |
| 15 | **Zoom Through Cut** | Zoom into frame A, cut straight into frame B already zoomed. | `MorphLensShowreel` — shot 05 → 06: the cut into the triptych | `ZoomThroughCut` |
| 16 | **Green Screen** | A green field is keyed out and a new scene shows through. | `MorphLensShowreel` — shot 07: the photo is keyed onto the phone's screen | `GreenScreen` |
| 17 | **Frame Break** | The picture breaks into rectangular tiles that fly in and settle — a shatter cut between shots. | `MorphLensShowreel` — **every cut**: each shot assembles itself out of pieces | `FrameBreak` |
| 18 | **Digital Zoom** | The picture breaks into a mosaic of blocks. | `MorphLensShowreel` — shot 04: the contrast change as a digital mosaic | `DigitalZoom` |
| 19 | **Phone Mockup** | The content sits inside a phone body. | `MorphLensShowreel` — shot 07: the app in a device | `PhoneMockup` |
| 20 | **Checklist** | A panel of steps that ticks itself off, one per beat. | `MorphLensShowreel` — shot 07: "what this reel covers" before the CTA | `Checklist` |

## The rules

1. **At most two effects per shot**, and never two of the same family: a
   *camera* effect (Snap Zoom, Dolly Zoom, Orbit, Zoom Through Cut) may share
   a shot with a *graphic* effect (Headline Stop, Checklist, Magazine Cover,
   Green Screen, Frame Break) — but two camera moves in one shot is a fight,
   not a shot.
2. **Effects are punctuation.** If a shot works without an effect, the effect
   goes. The reel is 38.5 s long; the effects are there to punctuate the
   cuts, not to fill them.
3. **Effects never cover the numbers.** The pixel values, the counters and
   the histograms are the content; an effect may frame them, never hide them.
   (The first version of this file shattered the *number matrix* into pizza
   slices — it read as broken glass, not as motion. The matrix is now clean,
   and the Frame Break effect does its work on the cuts between shots.)
4. **The before/after is always shown literally** — a seam, a portal, a flip
   or a mosaic. No effect is allowed to *describe* a change instead of
   showing it.
