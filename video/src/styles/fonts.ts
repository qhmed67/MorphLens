/**
 * fonts.ts — the reel's typefaces.
 *
 * Rubik (variable, from Google Fonts) carries the Arabic headlines — the
 * reference reels are Arabic-first and Rubik is the face the project guide
 * names. Space Grotesk and JetBrains Mono are the app's own faces, kept for
 * the English labels and the numbers.
 *
 * The @font-face rules are injected at module scope (before the first paint)
 * and the render is blocked on `document.fonts.ready`, so no frame is ever
 * captured with a fallback face.
 */
import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

const FONT_FILES = [
  { family: 'Rubik', weight: '300 900', file: 'fonts/Rubik-Variable.ttf' },
  { family: 'Space Grotesk', weight: 700, file: 'fonts/SpaceGrotesk_700Bold.ttf' },
  { family: 'Space Grotesk', weight: 600, file: 'fonts/SpaceGrotesk_600SemiBold.ttf' },
  { family: 'Inter', weight: 400, file: 'fonts/Inter_400Regular.ttf' },
  { family: 'Inter', weight: 600, file: 'fonts/Inter_600SemiBold.ttf' },
  { family: 'JetBrains Mono', weight: 500, file: 'fonts/JetBrainsMono_500Medium.ttf' },
];

if (typeof document !== 'undefined') {
  const css = FONT_FILES.map(
    (f) =>
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:block;src:url('${staticFile(
        f.file,
      )}') format('truetype');}`,
  ).join('\n');
  const style = document.createElement('style');
  style.setAttribute('data-morphlens-fonts', 'true');
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Block the render until every font is loaded and the browser is ready to
 * paint with them.
 */
export function useFonts(): boolean {
  const [handle] = useState(() => delayRender('Fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (!alive) return;
      setReady(true);
      continueRender(handle);
    };
    Promise.all(
      FONT_FILES.map((f) =>
        document.fonts.load(`${f.weight} 32px '${f.family}'`).catch(() => undefined),
      ),
    )
      .then(() => document.fonts.ready)
      .then(done)
      .catch(done);
    return () => {
      alive = false;
    };
  }, [handle]);
  return ready;
}
