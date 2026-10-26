# AGENTS.md — Project rules for any coding agent (OpenCode / Claude Code / Cursor)

Project: **MorphLens** — React Native (Expo) image-processing app with a "Morph UI" visual language. University image-processing course project; first review ≈ 2026-11-15.

## Stable baseline (2026-10-21) — read before the big refactor
This snapshot is the **known-good baseline** the owner asked to be preserved
before the next (large) round of changes. Everything below was green here:

| Gate | Value |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npx jest` | **257 tests / 24 suites**, all green |
| Engine coverage | ≥ 85 % (statements / branches / functions / lines) |
| `npx expo export --platform android` | 7.2 MB HBC |
| `npx expo-doctor` | 20/20 |
| QA sweep (`__tests__/qa/`) | all ten screens mount, show their title, unmount — **zero console errors** |

Rules for the next agent:
- **Do not regress this baseline.** A red gate after your change is a
  regression against *this* state, not a new normal. If a change cannot keep
  the gates green, split it or ask the owner.
- The QA sweep is the outside eye: extend `__tests__/qa/screens.test.tsx`
  (a new screen must appear there) and `__tests__/qa/invariants.test.ts`
  (the rules the app must never break again).
- `src/lab/imagePool.ts` owns every GPU (Skia) image lifetime. Never call
  `.dispose()` on an image the canvas may still be drawing — retire it with
  the pool instead.
- `src/core/navigation.ts#goBack` is the only way out of a screen; a bare
  `router.back()` prints a warning when the screen was opened directly.
- **Start the dev server with `npm run dev`** (not `npx expo start` in the
  foreground). The script detaches the server with `setsid`, so it survives the
  shell that started it — a plain background job dies with the session, and
  the phone then cannot open the app until someone restarts the server.
  `npm run dev:stop` stops it, `npm run dev:log` follows the log.

## Two hard rules from the owner (2026-10-21)

1. **The app must never look frozen.** Every edit, every filter, every
   recompute shows a working state: a shimmer (`MorphSkeleton`) where a photo
   would be, and/or a small "WORKING…" badge. Never run a heavy operation
   synchronously on the UI thread — go through `runOperationAsync` (it yields
   a frame first, so the badge is actually visible) and guard the result with
   a sequence number so a superseded run cannot overwrite a newer one.
   A black rectangle is never an acceptable "loading" state.
2. **Reuse what is already built.** The toolbox below exists — use it instead
   of writing a second version of the same thing, and add to it when you build
   something new that a future change will need twice.

## The toolbox (reusable, do not duplicate)

| Tool | Use it for |
|---|---|
| `src/lab/imagePool.ts` | Every GPU (Skia) image lifetime: `pool.retire(image)` instead of `dispose()` (the canvas may still draw it), `pool.disposeAll()` on unmount. |
| `src/core/navigation.ts#goBack` | Leaving a screen safely (never call `router.back()` directly). |
| `src/lab/useLabSource.ts` | The pixel feed for any Lab screen: synthetic fallback, cached GPU readback, delayed disposal. |
| `src/lab/arabicGuides.tsx` | **All** Arabic copy in one place (the owner edits it there). |
| `src/lab/denoiseFilters.ts` | The Denoise Arena catalogue (filters + noise models). |
| `src/lab/toneCurve.ts` | The tone-curve maths: `buildToneLut`, `toneAt`, presets. |
| `src/lab/kernelInput.ts` | Kernel parsing (`parseKernelWeight`) and `convolveParams` (3×3 guard). |
| `src/core/threads.ts` | `scheduleOnRN` / `scheduleOnUI` (the Worklets 0.13 bridge). |
| `src/morph/MorphSkeleton.tsx` | The shimmer placeholder — use it instead of a black hole. |
| `src/engine/exec.ts` | `runOperationAsync` + the `shouldCancel` sequence guard. |
| `__tests__/qa/screens.test.tsx` | The QA sweep: a new screen must be added there. |
| `__tests__/qa/invariants.test.ts` | The rules the app must never break again. |
| `jest.resolver.js` | Reanimated/Worklets under Jest (web build). |
| `npm run dev` | The detached dev server (a foreground one dies with the session). |
| `src/lab/codeExcerpts.ts` | The **Python** snippets the Trace "Code" tab shows (the app's own code stays TypeScript). |

## Read first, every session
1. `architecture.md` (esp. **§18**, which overrides §3/§6/§14 on conflict)
2. `design.md` (tokens, motion, visual language)
3. `SKILL.md` (how to write every UI component) — mandatory for any UI/animation/shader work
4. `PLAN.md` if it exists (the approved plan; update checkboxes as you go)

## Non-negotiables
- **Free only.** MIT/Apache/BSD/OFL/CC0. No paid SDKs, APIs, fonts or assets. No Shadertoy copy-paste.
- **React Native + Expo (Expo Go compatible), TypeScript strict.** Install via `npx expo install`.
- **Engine purity:** `src/engine/**` is pure TypeScript — no React/Skia/Reanimated imports (except `src/engine/bridge/skia.ts`).
- **No React state in the frame loop** (see SKILL.md hard rules).
- **Tokens only** for colour/radius/spacing/spring/duration.

## Comments & docs
- TSDoc on every exported function; header comment on every algorithm file (theory, formula, complexity, reference by book/chapter name — never copy text).
- Inline comments explain *why*. English only.
- Keep `docs/ALGORITHMS.md` updated when an algorithm is added or changed.

## Tests
- Jest (`jest-expo`). Every engine function ships with tests in the same change. Use synthetic in-code fixtures (no binary assets).
- `npx tsc --noEmit`, `npm run lint`, `npm test` must all pass before a phase is called done. Never delete or weaken a test to make it pass — fix the code or ask.

## Git policy (strict)
- `git init` locally is fine; keep a proper `.gitignore` (node_modules, .expo, dist, ios/android build outputs, coverage, `.env*`).
- **Do NOT** set `user.name` / `user.email` (local or global), **do NOT** commit, **do NOT** push, **do NOT** add remotes — until the owner explicitly gives you a name and email in chat.
- Once given: commit with a one-off identity (`git -c user.name="<name>" -c user.email="<email>" commit …`), never persisted to config. Every commit message ends with a blank line and:
  `Co-authored-by: opencode <noreply@opencode.local>`
- Never reveal or invent real names/emails. Never `git push`, `git remote add`, `git config --global`.
- Conventional commits, one logical step each (`feat(engine): add median filter`).

## Working style
- Plan → implement in small verified steps → run checks → report. After each phase give a short summary: what works, what was skipped, what to look at.
- If an API is uncertain, read the docs for the **installed** version before coding (links in SKILL.md §0).
- If a requirement is ambiguous and the answer changes the architecture, ask once, concisely; otherwise choose the simplest option and note it in `PLAN.md`.
- Visual impact is the grading priority: when time is short, protect Lab-mode visuals and tests, cut breadth.
