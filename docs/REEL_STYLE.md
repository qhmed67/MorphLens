# REEL STYLE — the MorphLens reel house style

> The reference reels live in `/home/dev/Video refrences` (five MP4s, 720×1280).
> They are **all the same priority**: this bible is the common denominator of
> all five, not a blend weighted towards any one of them.
>
> Every rule below was measured from the references — the palette was sampled
> from their frames, the rhythm from their motion curves.

---

## 1. The look in one line

A **light warm-paper page** where **one product visual floats in a card** at a
time, with a **short Arabic headline underneath**, one word of it painted in a
**single warm accent**, and a **grey second line** doing the explaining.

## 2. Palette: black, and colour that means something

**There is no brand colour.** The owner does not want orange, and does not
want dark reels. So:

| role | value | rule |
|---|---|---|
| page | `#EFEDE4` warm paper | never white, never dark |
| ink | `#141412` | everything neutral — the default for all type |
| **good** | `#0F7A46` green | a result that improved, a value kept, the winner |
| **bad** | `#B4342B` red | noise, an outlier, a value that was thrown away |

Colour is **meaning, never decoration**: a keyword that is only an emphasis
gets an ink swatch behind it instead of a hue. Both greens and reds are
lifted (`#3FCF8E` / `#FF8272`) when they sit on the dark chapter card.

Implementation: `good` / `bad` / `goodOnDark` / `badOnDark` in
`src/styles/tokens.ts` and `src/styles/theme.ts`. The old `accent` token is
kept only as a deprecated alias for the ink.

### Old note (kept for the record) — sampled from the five

| Role | Value | Where it comes from |
|---|---|---|
| Page | `#EFEDE4` (warm paper) | the references run `#E5E2DB` → `#F2F2EA`; this is the middle |
| Card | `#FFFFFF` | the white cards in ref1/ref3/ref4 |
| Ink | `#141412` | the headline colour in all five |
| Sub-line | `#6E6C65` | the grey second line in all five |
| **Accent** | **`#D2644C`** (coral) | ref1 `rgb(192,96,80)`, ref2/3/4 `rgb(208,112,80)` — the recurring accent in 4 of 5 |
| Chapter card | `#12140F` | the near-black section cards in ref1/ref2/ref3/ref4 |
| Hairline | `rgba(20,20,18,0.10)` | the card edges |

**The accent is used sparingly** — only for the highlighted keyword, the number
badge, the step counter and the CTA keyword. Never for a background, never for
body text. (ref5 swaps the accent for deep green `#004030`; the *rule* is one
accent, not which one.)

## 3. The background

- Warm paper, never pure white, never dark.
- A **faint dot grid** (ref3) or hairline grid (ref2) — very low contrast.
- A **soft vignette** at the edges.
- A **decorative motif** scattered around the page: the sunburst/asterisk
  glyph in ref2/ref3, the coral scribbles in ref1. For MorphLens: a small
  8-point sunburst drawn in the accent, used as a whisper, not a pattern.

## 4. The card (the unit of the whole reel)

Every visual is a **card**, never a full-bleed photo:

- radius ≈ 28 px (at 1080 wide), 1 px hairline, a soft warm shadow
  (`0 30px 60px rgba(60,50,40,0.14)`), and a slight rotation of 1–4°.
- Cards sit in **depth**: a stack of two or three, tilted, with a parallax
  offset — the back card is blurred or dimmed.
- The card **enters** with a soft rise + scale (spring), and the visual inside
  it keeps a slow camera drift for the length of the beat.

## 5. Type (Arabic-first)

| Role | Face | Size @1080 | Notes |
|---|---|---|---|
| Headline | **Rubik 700/800** | 52–64 | RTL, tight leading, near-black |
| Highlighted word | Rubik 800 | — | the **accent** colour, the only coloured word in the caption |
| Second line | Rubik 400/500 | 26–30 | mid-grey, the detail that explains |
| Step counter | JetBrains Mono 500 | 24 | the accent colour, `01 / 04` |
| Numbers / code | JetBrains Mono 500 | 26–34 | every pixel value, every formula |
| English labels | Space Grotesk 600 | 22–26 | the pill tags |

- The caption block sits **under the visual**, left-aligned (RTL), 2 lines max.
- The headline is **one idea**, not a sentence.
- The second line is **grey** and always says *why*, not *what*.

## 6. Structure

- **A beat = one visual + one caption.** A new beat every **1.5–3.5 s**.
- **Step counter** in the top-right of the beat: `01 / 04` in the accent, with
  the step's name in Arabic next to it (ref4).
- **Pills**: a small rounded tag next to the visual — a number badge in an
  accent circle (ref1: `01`, `02`) or a white pill with a dot (ref2: `Cuts`,
  `Motion Graphics`).
- **Chapter card**: a near-black card that opens a section, with the English
  name on top and the Arabic name below (ref2: `CLAUDE CONNECTORS`).
- **End card**: a big headline with the keyword in guillemets and the accent
  (`اكتب «WEBSITE» في التعليقات`), a dark pill button, and the brand mark.

## 7. Motion

| Beat | What moves |
|---|---|
| card in | rise 40 px + scale 0.94 → 1, spring, 12–16 frames |
| visual in | the camera keeps drifting inside the card (never a still image) |
| caption | the headline lands first, the grey line 6 frames behind it |
| keyword | the accent word fades up 2 frames after the rest of the headline |
| numbers | they count up, they don't just appear |
| out | the card lifts and fades, the next one is already arriving |

Nothing is static: even a card that "holds" has the picture moving inside it.

## 8. Sound

The references are voice-over reels with music. This one has **no voiceover**
and **no music** (the brief forbids inventing either), so the sound design is
purely the *motion* sounds: a whoosh on each card change, a pop on each
highlighted word and each result, a click on each pill, a sweep on each
chapter, and a `zoomin`/`zoomout` under every camera move inside a card.

## 9. What this means for the MorphLens reel

- The photo is **a card**, not a background — the camera moves *inside* it.
- The captions are **Arabic**, taken from the app's own
  `src/lab/arabicExplain.ts` (the same words the app shows the user).
- One accent (`#D2644C`) on a warm paper, with the app's ink and hairlines.
- The numbers stay mono and stay real — they still come out of the app engine.

## 10. Priority rule

All five references carry **the same weight**. When two references disagree
(e.g. ref2's blue secondary accent vs ref3's single coral), take the option
that appears in the **most** of them, and if it is still a tie, take the
**simplest** one. Nothing from a reference outranks anything else from the
others.


## 11. Captions: three words, and they must be shown

The owner's rule for every page of every reel: **a caption is a word, two, or
three — never a sentence.** And the words are not a label glued on top of the
picture; the copy and the shot have to say the same thing at the same moment:

* the word is **timed to the evidence** — "بيزيد" lands on the frame where the
  counter starts rising; "تقوّى" lands the frame the sharpened layer appears;
  "بعد" lands as the before/after portal finishes opening;
* the word **names what is visible**, not what is explained — a page that shows
  three cards says "تلّة فلاتر", a page that shows a grid counting says "كل رقم
  يتغيّر";
* technical annotations under a number (`+110 لكل بكسل`, `PSNR 41.2 dB`) are
  counted the same way: three words or fewer;
* the CTA is two words: **اكتب PHOTO**.

The implementation is `WordCaption` in `src/components/Modern.tsx`: each word
pops in on its own beat with a per-word `at` offset, and a coral rule draws
under the caption once the last word lands. The long sentence captions that
used to sit under every shot are gone.

