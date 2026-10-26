/**
 * navigation.ts — one safe way to leave a screen.
 *
 * `router.back()` throws a console warning ("The action 'GO_BACK' was not
 * handled by any navigator") whenever the screen was opened directly — a deep
 * link, a cold start, or the Expo Go "recently opened" list. Every screen in
 * the app uses this helper instead, so the warning never reaches the owner.
 */
import type { Href } from 'expo-router';

/** Minimal shape of the router pieces this helper needs. */
type BackRouter = {
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
};

/**
 * Go back if there is somewhere to go back to; otherwise land on the Home
 * screen. Never leaves the user on a dead end.
 */
export function goBack(router: BackRouter, fallback: Href = '/'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
