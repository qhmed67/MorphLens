# CLAUDE CODE + REMOTION | BEGINNER GUIDE

> The complete beginner guide + copy-ready master prompt.
> Turn a voiceover, optional reference video, and authentic assets into a
> professional vertical Reel. Designed for first-time users: setup, editing,
> synchronization, export, and quality checks are all included.
>
> **This file is the memory of how a MorphLens reel is produced.** Keep it in
> the repo: any agent (or human) building a video for this project reads this
> file first, then `docs/design.md` for the brand style, then the project
> brief in `video/README.md`.

---

## 1. What you need before starting

- A computer with Node.js LTS and npm installed (check with `node --version` and `npm --version`).
- Claude Code installed and authenticated using the official Anthropic instructions; an active account with appropriate access.
- FFmpeg installed (check with `ffmpeg -version`).
- Your original voiceover named `original.mp3` or `original.wav`, if available.
- Optional `sample.mp4` reference, optional logo/assets, and your script/transcript.
- A project folder you can open in a terminal. The prompt below will create a Remotion project if none exists.

## 2. Replace the [BRACKETS] before using the prompt

- `[PROJECT_NAME]` = folder name, e.g. `my-premium-reel`
- `[VIDEO_TOPIC]` = subject of your Reel
- `[TARGET_AUDIENCE]` = who should watch
- `[VOICEOVER_FILE]` = `original.mp3` or `original.wav` (or `NONE`)
- `[REFERENCE_VIDEO]` = `sample.mp4` (or `NONE`)
- `[SCRIPT_OR_TRANSCRIPT]` = exact spoken script (or `TRANSCRIBE_FROM_AUDIO`)
- `[BRAND_COLORS]` = e.g. `#0B1220, #22D3EE`
- `[LANGUAGE]` = Arabic / English / bilingual
- `[CTA]` = final call to action
- `[OUTPUT_FILENAME]` = e.g. `remotion_reel`
- `[ASSETS_FOLDER]` = `assets` (or `NONE`)

Put files inside the project folder, then paste the full master prompt into Claude Code. Brackets are placeholders, not literal final values.

## 3. Master prompt — copy everything below

### ROLE & GOAL

You are an elite creative director, motion designer, professional video editor, and senior Remotion/React/TypeScript engineer. Create a polished, production-ready vertical social Reel for `[VIDEO_TOPIC]`, targeting `[TARGET_AUDIENCE]`. This is a real video production task, not a generic slideshow. Work autonomously but report missing essential assets rather than inventing them.

### PROJECT INPUTS

```
Project:            [PROJECT_NAME]
Voiceover file:     [VOICEOVER_FILE]
Reference video:    [REFERENCE_VIDEO]
Script/transcript:  [SCRIPT_OR_TRANSCRIPT]
Language:           [LANGUAGE]
Brand colors:       [BRAND_COLORS]
Call to action:     [CTA]
Additional assets:  [ASSETS_FOLDER]
Final output name:  [OUTPUT_FILENAME]
```

Output format: 1080x1920, 9:16, H.264 MP4 + AAC, 30 fps unless 60 fps materially improves the motion. Export a separate 1080x1920 PNG thumbnail.

### PHASE 1 — ENVIRONMENT & SETUP FOR FIRST-TIME USERS

1. Inspect the current working directory. If it already contains a working Remotion project, reuse its package manager, packages, fonts, and components; do not overwrite user work.
2. If there is no Remotion project, check Node.js/npm and create a new official Remotion project using the current supported official starter/setup flow. Install required dependencies using the chosen package manager. Use React and TypeScript. Do not invent package names or outdated commands.
3. Check FFmpeg and the Chromium/browser renderer requirements for the installed Remotion version. If a system dependency is missing, explain exact OS-specific install commands and pause only when installation requires user action or elevated permissions.
4. Make organized folders for `public/assets`, `src/components`, `src/scenes`, `src/styles`, `output`, and documentation as appropriate. Ensure media file paths work in Remotion.
5. Use the Google Rubik font with correct Arabic glyph support, RTL shaping, punctuation, and safe fallbacks. Verify that fonts actually load during rendering.
6. Provide a concise README explaining installation, preview, rendering, and asset replacement.

### PHASE 2 — MEDIA INSPECTION & REFERENCE ANALYSIS

1. Inspect all provided files using ffprobe/FFmpeg and available media tools: exact voiceover duration, sample rate, audio peaks, silence, video resolution, frame rate, and reference length.
2. If `[REFERENCE_VIDEO]` is provided, analyze its first 3 seconds, cut density, composition, caption placement, typography, color palette, transitions, motion, camera movement, SFX, and visual storytelling. Match the production language and pacing while improving clarity and quality. Do not copy watermarks, third-party branding, or copyrighted shots.
3. If no reference is provided, establish a premium visual direction: dark cinematic backgrounds, high contrast, clean typography, tasteful motion graphics, authentic assets, and punchy edits.
4. If a transcript is supplied, align its words to the actual voiceover. If transcript is not supplied, use an available transcription/forced-alignment workflow when feasible; do not claim exact word-level alignment if it was not measured. If no voiceover exists, request it or create a clearly marked silent draft only with user approval.
5. Build a scene-by-scene, time-coded storyboard covering the full audio duration before coding.

### PHASE 3 — STRONG OPENING HOOK & VISUAL DIRECTION

1. The first 1–3 seconds must immediately attract attention: sharp visual reveal, energetic but clean typography, deliberate camera push, synchronized impact sound, and the most compelling phrase from the narration.
2. Keep cuts and visual changes motivated by the speech; avoid long static screens, random B-roll, excessive 3D, generic stock illustrations, and repetitive transitions.
3. Prefer real logos, official websites, authentic product screens, GitHub repositories, documentation, actual browser/terminal demonstrations, and relevant licensed B-roll. Do not fabricate interfaces, claims, statistics, or technical features.
4. For software topics, use a realistic progression where relevant: search/official page -> documentation -> editor or terminal -> result. Capture real screenshots or browser footage if available.
5. Use masking, parallax, smooth zooms, spring animations, subtle blur, motion blur, kinetic typography, and UI clicks only when they support the narration.

### PHASE 4 — AUDIO IS THE MASTER TIMELINE

1. Use the ORIGINAL supplied voiceover as the single source of narration. Do not replace, regenerate, speed up, or rewrite it without permission.
2. The full composition duration must match the audio precisely, with no early ending, clipped syllables, or unnecessary dead air. Map scene start/end frames from timestamps at the chosen FPS.
3. Synchronize text emphasis, logo entrances, UI demonstrations, cuts, and impacts to spoken words and natural pauses.
4. NO BACKGROUND MUSIC UNDER ANY CIRCUMSTANCES unless explicitly requested by the user. Use only voiceover, tasteful whooshes/impacts, UI clicks, and subtle transition effects. Keep SFX below narration, avoid clipping, and use smooth fades.
5. If SFX files are not available, create clean simple non-musical effects only if practical and licensed, or omit them rather than inserting music.

### PHASE 5 — CAPTIONS, ARABIC & MOBILE READABILITY

1. Use large, legible animated captions in Rubik, correctly handling Arabic RTL and mixed Arabic/English phrases.
2. Highlight only important words, timed to their actual speech; use restrained brand-color accents.
3. Keep essential titles, captions, logos, and CTA within platform-safe margins; avoid edges and common UI overlay zones.
4. Prefer short 1–2 line caption groups and good line breaks. Ensure captions do not overlap logos, faces, browser content, or each other.
5. Validate Arabic shaping and text direction in rendered frames, not just in code.

### PHASE 6 — REMOTION IMPLEMENTATION

1. Implement reusable React/TypeScript components for scene layout, kinetic captions, brand logo treatments, UI/browser demo, transitions, progress cues, and end card.
2. Use Remotion's frame-based timing, `Sequence`, `interpolate`, `spring`, and appropriate transitions. Do not rely on nondeterministic browser timers, network calls during render, or uncontrolled CSS animation timing.
3. Preload or bundle assets; handle missing media gracefully. Preserve aspect ratio and avoid stretching.
4. Use frame-accurate timing and ensure every frame has an intentional background; never allow black flashes, empty gaps, glitchy masks, or jump cuts caused by off-by-one timing.
5. Add lightweight visual texture and intentional depth, but prioritize a clean, premium look over decoration.

### PHASE 7 — RENDER, REVIEW & ITERATE

1. Produce a low-resolution or short preview first, inspect the opening hook and at least several transitions, then render the full 1080x1920 video.
2. Extract and inspect representative frames at the beginning, middle, and end; verify text legibility, safe areas, RTL, real assets, transition continuity, and CTA.
3. Check output with ffprobe: codec, width/height, frame rate, duration, and audio stream. Check audio levels/clipping with FFmpeg where feasible.
4. Fix issues and rerender. Do not claim quality checks you did not actually perform.
5. Export `output/[OUTPUT_FILENAME].mp4` and `output/[OUTPUT_FILENAME]_thumbnail.png`. Design the thumbnail separately with a strong short headline, accurate logos, premium contrast, and mobile readability.
6. Include `storyboard.md`, `README.md`, and a short QA report describing what was verified and any limitations.

### FINAL DELIVERY RULES

The result must feel like a premium motion-design agency edit, not an AI-generated slideshow. The voiceover is always the master timeline. No background music. Use authentic visuals. Match a supplied reference's pacing without copying unrelated branding. Start with the setup, inspect the assets, build the storyboard, implement the video, render, verify, and provide exact output paths and commands. Ask only for truly missing inputs that block a truthful or functional result.

## 4. How to run the finished project

- Open a terminal in the project directory and launch Claude Code according to its official installation instructions.
- Place `original.mp3` and optional `sample.mp4` in the project; update the bracket placeholders in the prompt.
- Paste the master prompt. Approve local dependency installation when prompted.
- Preview in Remotion Studio using the script and commands generated in `README.md`.
- After rendering, inspect `output/[OUTPUT_FILENAME].mp4` and `output/[OUTPUT_FILENAME]_thumbnail.png`.

## 5. Troubleshooting checklist

- **No audio**: check the path, codec, and whether the voiceover is included in the Remotion composition.
- **Arabic text disconnected or reversed**: verify the font supports Arabic and render RTL text correctly.
- **Video black frames**: inspect `Sequence` boundaries, asset loading, and composition duration.
- **Bad timing**: use measured timestamps and frame calculations, not guessed scene durations.
- **Missing browser or FFmpeg**: install required platform dependencies and retry.
- **Export too large**: adjust H.264 quality settings without sacrificing readability.

> Reminder: AI-generated code and timing still require human review. Official tools and install steps can change; follow the current official Remotion and Claude Code documentation.

---

## 6. How this project applies the guide (MorphLens)

The guide is generic; the MorphLens reel (`video/`) is a concrete application of it. Where the project deviates, the deviation is deliberate and recorded here:

| Guide rule | What this project does | Why |
|---|---|---|
| Voiceover as master timeline | **No voiceover was supplied, so none was invented.** The reel is a silent, caption-led explainer with frame-accurate motion, and no background music. | A generated or borrowed voice would be a fabricated asset; the guide allows a clearly marked silent draft. |
| Rubik for Arabic | The reel is English-only; the app's own faces are used (Space Grotesk / Inter / JetBrains Mono). The `عربي` tab in the end card is the app's real UI, not a typeset caption. | The app ships three Latin faces only; pulling in a fourth family for a single word would break the brand. |
| Dark cinematic backgrounds | **Light-first monochrome** (paper / ink / graphite), because that is the MorphLens design language (`docs/design.md` §2). | Brand consistency beats a generic reel look. |
| 1080×1920 H.264 30 fps | Exactly that: `output/morphlens_lab_reel.mp4`, H.264 / yuv420p / 30 fps / 1840 frames. | — |
| Thumbnail exported separately | `output/morphlens_lab_reel_thumbnail.png`, its own composition. | — |
| Authentic visuals | The photo is a real CC BY-SA photo; **every number on screen is produced by the app's own engine** (`src/engine/**`) via `video/scripts/build-assets.ts`. | The guide forbids fabricating interfaces or claims. |
| Real GPU use | Headless Chromium renders through EGL (NVIDIA), H.264 is encoded by `h264_nvenc`. | The brief requires the NVIDIA card, not the CPU. |
