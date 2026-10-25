# Asset credits

## Photo

**“Ant on a golden club”** — photograph by *Rhododendrites*,
CC BY-SA 4.0, via Wikimedia Commons:
<https://commons.wikimedia.org/wiki/File:Ant_on_golden_club_(24749).jpg>

- Source file: 3483 × 5017 px, JPEG
- Used in the reel as `hero.png` (960 × 1440, centre crop) and, through the
  app's own engine, as `hero_bright.png`, `hero_contrast.png`, `hero_blur.png`,
  `hero_detail.png`, `hero_sharp.png` and the 16 × 16 crops.
- Attribution appears on the reel's end card and in `video/README.md`.

The licence (CC BY-SA 4.0) requires share-alike and attribution: any published
version of the reel keeps the credit line, and a modified video must be
published under the same licence.

## Fonts

The three typefaces the MorphLens app already ships, copied from the app's
`node_modules/@expo-google-fonts` packages into `public/fonts/`:

| Family | Weights | Licence |
|---|---|---|
| Space Grotesk | 600, 700 | SIL Open Font License 1.1 |
| Inter | 400, 500, 600 | SIL Open Font License 1.1 |
| JetBrains Mono | 500 | SIL Open Font License 1.1 |

## Code and motion

The pixel-processing behind every number in the reel is the MorphLens engine
(`src/engine/**`, part of this repository) — the reel renders the same
algorithms the app runs on the phone.
