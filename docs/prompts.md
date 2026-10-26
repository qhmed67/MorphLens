# prompts.md — Two prompts for the coding agent (OpenCode)

Put these files in the project root first: `design.md`, `architecture.md`, `SKILL.md`, `AGENTS.md`.
(Also place `SKILL.md` at `.claude/skills/morph-rn/SKILL.md` or reference it from `AGENTS.md`.)

Use **Prompt 1 (PLAN)** in plan mode / a read-only session. Review `PLAN.md`, answer its questions, then use **Prompt 2 (BUILD)**.
If you want one single prompt, paste Prompt 2 directly — it tells the agent to create the plan itself when `PLAN.md` is missing.

---

## PROMPT 1 — PLAN

```
You are the lead engineer for MorphLens, a React Native (Expo) mobile app that is both a university
Image Processing course project and a showcase of a fluid "Morph UI" visual language built only with
free tools.

## Step 0 — Read everything before thinking
Read, in this order, completely: AGENTS.md, architecture.md (pay special attention to §18, which
overrides §3, §6 and §14 on conflict), design.md, SKILL.md. Do not start from memory of similar
projects; the files are the specification.

## Project brief
- The app lets a user pick a photo and modify it with image-processing functions: colour changes,
  noise removal, enhancement, edge detection, frequency-domain filtering, morphology — plus artistic
  real-time "Creative" filters (GPU shaders).
- The instructor asked for ideas that are fresh and not repeated across students, while still
  covering the course material. Our answer is "Lab mode / Algorithm Theatre": every algorithm is
  shown working visually (kernel sliding over pixels, histogram morphing flat, FFT spectrum with a
  draggable mask, noise-injection arena with PSNR/SSIM and error heatmaps, 3-D colour-space cloud,
  animated Canny stages). THE VISUALS ARE THE PRIORITY: the audience must be impressed.
- Architecture: UI layer (React Native, Reanimated, Skia) + business-logic "backend" = a pure
  TypeScript engine in src/engine/ (no UI imports) exposed through one facade. See architecture.md §18.
- Hard constraints: zero budget (free/open-source only), Expo Go compatible, React Native only,
  TypeScript strict, mid-range Android >= 55 fps, offline.
- Deadline: first review about 4 weeks after 2026-10-18 (~2026-11-15). Work is delivered week by week
  per architecture.md §18.8.
- Quality gates: explanatory comments everywhere (TSDoc + algorithm header comments), unit tests with
  Jest for the engine (>= 85 % coverage on src/engine), tsc/lint/test all green.
- Git rule: use git locally only. Do NOT configure identity, do NOT commit, do NOT push, do NOT add
  remotes until the owner gives a name and email. After that: per-command identity, never persisted,
  trailer "Co-authored-by: opencode <noreply@opencode.local>". Details in AGENTS.md.

## Your task now: PLAN ONLY — do not write application code, do not install packages, do not run git commit.
You may run read-only commands (ls, cat, git status) and check current docs for the versions we will
install (Expo SDK, Reanimated 4 / react-native-worklets, @shopify/react-native-skia, Gesture Handler).

Produce a file `PLAN.md` in the project root containing:

1. **Verified tech decisions** — exact package list and versions to install with `npx expo install`,
   babel/tsconfig/jest-expo setup, and any API in the specs that you found outdated or wrong for the
   installed versions (e.g. worklets thread-bridging names, Skia image/pixel APIs, Skia
   `Image.MakeImage`/`readPixels`, background-runtime options for heavy engine work). Propose
   corrections to the spec files as a list; do not edit the spec files yet.
2. **Algorithm catalogue** — for every engine operation in architecture.md §18.2: name, formula in
   one line, parameters with ranges, complexity, which screen demonstrates it, whether it also gets
   an SkSL live version, and its test cases (named, with expected values where computable by hand).
3. **Screen specs for Lab mode** — for each of the 9 screens in §18.3: layout sketch (ASCII), the
   exact signature visual, which shared values drive it, the engine calls it makes, performance risks
   and the mitigation, and a degraded fallback if it misses frame budget.
4. **Week-by-week task breakdown** — follow §18.8, but split into tasks of at most half a day each,
   with dependencies, definition of done per task, and which files each task creates. Mark the
   "must ship for the first review" set and the cut order.
5. **Test plan** — fixture list, property tests, known-value tests, reference-vs-shader parity test,
   coverage command, and how tests run without a device.
6. **Risk register** — top 10 technical risks (Skia pixel read/write speed, FFT cost on-device,
   median/bilateral cost, memory with large images, Expo Go limitations, worklet runtime API
   changes, blur performance on Android, etc.), each with likelihood, impact, early spike to retire it,
   and fallback.
7. **Spikes to run first (day 1–2)** — small throwaway experiments with pass/fail criteria, e.g.:
   (a) Skia image -> RGBA bytes -> TS processing -> Skia image round-trip timing at 512 px;
   (b) 256x256 2-D FFT time in Hermes; (c) 5x5 median at 512 px time; (d) SkSL uniform-driven
   brightness slider at 60 fps; (e) container transform with measureInWindow in expo-router.
8. **Demo script** — a 5-minute walkthrough for the instructor that showcases the best visuals in the
   best order, plus the viva cheat-sheet outline (docs/ALGORITHMS.md structure).
9. **Open questions for the owner** — at most 6, only those that genuinely change the plan. Provide a
   recommended default for each so work can proceed if unanswered.

Formatting: concise, tables where useful, checkboxes `- [ ]` for every task so the build agent can
tick them. When done, print a 10-line summary and STOP. Wait for the owner's approval.
```

---

## PROMPT 2 — BUILD

```
You are the lead engineer for MorphLens (React Native + Expo, TypeScript strict). Build the project
end-to-end in small verified steps.

## Step 0 — Read the specification (mandatory, every session)
Read completely: AGENTS.md, architecture.md (§18 overrides §3/§6/§14 on conflict), design.md,
SKILL.md, and PLAN.md if it exists. If PLAN.md does NOT exist, create it first using this process:
read the specs, verify current package APIs in the installed versions' docs, write a concise plan with
checkboxes per architecture.md §18.8, then continue to build without waiting.

## What we are building
A mobile app where the user picks a photo and applies image-processing functions — colour
changes, noise removal, enhancement, edges, frequency-domain filtering, morphology — plus artistic
real-time Creative filters. It is a university Image Processing course project; the instructor wants
fresh ideas and course-relevant functions. The decisive quality is the VISUAL explanation of
algorithms (Lab mode "Algorithm Theatre", architecture.md §18.3) and fluid Morph UI motion, all with
free libraries only. The business logic/"backend" is the pure-TypeScript engine in src/engine/
behind a facade; the UI never manipulates pixels directly.

## Rules (binding)
1. Follow design.md tokens/motion and the SKILL.md hard rules, workflow (§3) and Definition of Done
   (§10) for every UI component. Never invent colours/radii/springs/durations; add to tokens/motion first.
2. src/engine/** is pure TS: no React, Skia or Reanimated imports (only src/engine/bridge/skia.ts may
   import Skia). Pure functions, no input mutation, deterministic seeded noise, explicit border modes.
3. Comments: TSDoc on every exported function; every algorithm file starts with a header comment
   (theory, formula, complexity, textbook reference by name, edge cases); inline comments explain why.
4. Tests: every engine function ships with Jest tests in the same change, using synthetic in-code
   fixtures. Include property tests, known-value tests and the TS-vs-SkSL parity test described in
   §18.5. Target >= 85 % coverage on src/engine. Never delete/weaken tests to get green.
5. Gates: `npx tsc --noEmit`, `npm run lint`, `npm test` must all pass before ticking a task done.
   Verify UI work against the perf checklist (SKILL.md §7): no React state in frame loops, <= 3
   canvases, particles <= 120, <= 2 BlurViews, heavy engine work off the UI path with progress.
6. Free only; Expo Go compatible; if something truly needs a dev build, stop and ask.
7. When unsure about an API, read the docs for the INSTALLED version (links in SKILL.md §0). If the
   spec files are wrong for the installed versions, fix the spec file in a separate, clearly described
   change and note it in PLAN.md.

## Git rules (strict — also in AGENTS.md)
- Run `git init` locally if the repo does not exist and create a proper .gitignore.
- DO NOT set user.name or user.email (local or global). DO NOT commit. DO NOT push. DO NOT add
  remotes. Keep changes in the working tree and mention in each phase report which files changed.
- ONLY after the owner writes a name and email in chat: commit using a one-off identity
  (`git -c user.name="<name>" -c user.email="<email>" commit -m "..."`), never persisted to config,
  with this trailer on every commit message (blank line before it):
  Co-authored-by: opencode <noreply@opencode.local>
- Conventional commit messages, one logical step per commit. Never push; never invent identities.

## Execution order (summary of architecture.md §18.8)
Week 1: Expo scaffold, tokens/motion/threads, fonts, router shell, root overlay host; primitives
(MorphPressable, MorphSurface, MorphSlider, MorphSwitch, MorphSheet, MorphChip, GooBlobs,
MorphSkeleton) with a /gallery route; engine core (buffer, convolve, kernels, color spaces/adjust,
noise generate + metrics, histogram) with tests; image import + preview proxy.
Week 2: remaining engine MVP (mean/gaussian/median/bilateral, equalize, CLAHE, unsharp, white balance,
Sobel/Canny, FFT + frequency filters) with tests; Skia bridge; Convolution Explainer and Denoise Arena.
Week 3: Histogram Surgery, Frequency Playground, Enhance Studio; Creative mode canvas with the six
launch filters (Aurora, Liquid, Vortex, Glitch, Duotone, Noir) and The Drop choreography; HUD histogram.
Week 4: polish and buffer — Colour Space Explorer / Edge Race if time permits, Explain sheets and
operation log for every operation, Home with container transforms, export, accessibility and
reduced-motion pass, docs/ALGORITHMS.md, demo script, sample CC0 photos.
Cut order if late: Colour Transfer -> Morphology -> Edge Race -> Colour Explorer -> extra Creative
filters. Never cut tests, comments, Denoise Arena, Convolution Explainer or Frequency Playground.

## How to work
- Start with the day-1 spikes from PLAN.md (pixel round-trip timing, FFT time, median time) and adapt
  the design if a spike fails; record results in PLAN.md.
- Work task by task: implement -> run gates -> tick the checkbox -> next. Keep diffs small.
- After each phase print a short report: what works, how to see it (route/screen), test/coverage
  numbers, fps observations, what was skipped and why, and what you need from the owner.
- Ask the owner only when an answer changes the architecture; otherwise pick the simplest option and
  log the decision in PLAN.md.
- Begin now with Phase 0 (scaffold) and the spikes, and continue until the end of week 1's gate;
  then report and continue to the next phase unless told to stop.
```
