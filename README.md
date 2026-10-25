# MorphLens

MorphLens is a React Native (Expo) image-processing app and a teaching **Algorithm Theatre**. It runs classical image-processing algorithms — convolution, denoising, histogram equalisation/CLAHE, tone curves and enhancement — on the user's own photos, with live metrics and step-by-step explanations in English and Arabic.

## Stack

- Expo SDK 58 · React Native 0.88 · TypeScript (strict)
- React Native Skia · Reanimated 4 · Worklets · Expo Router
- Pure TypeScript engine in `src/engine` (no React/Skia imports outside the bridge)

## Run

```bash
npm install
npm run dev        # detached Metro server for Expo Go
npm run dev:log    # follow the server log
npm run dev:stop   # stop the server
```

Open the printed `exp://…` URL in Expo Go (same Wi-Fi).

## Quality gates

```bash
npx tsc --noEmit
npm run lint
npm test
```

## Screens

- **Home** → *Edit a photo* (editor) or *Lab mode*
- **Lab mode** → Convolution Explainer, Denoise Arena, Histogram Surgery, Enhance Studio
- **Trace** (`/explain/[op]`) → real algorithm stages, maths plot, Python excerpt and Arabic explanation

## Documentation

See `docs/` for architecture, design and algorithm notes; `PLAN.md` records the build log and verification status.
