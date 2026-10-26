/**
 * Single adaptation point for thread bridging (SKILL §1 rule 9).
 *
 * Worklets 0.13 deprecates Reanimated's `runOnJS`/`runOnUI` in favour of
 * `scheduleOnRN`/`scheduleOnUI`; re-export the modern names and keep thin
 * deprecated aliases so spec-era code still compiles in one place.
 */
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

export { scheduleOnRN, scheduleOnUI };

/** @deprecated Use `scheduleOnRN` from `@/core/threads`. */
export const runOnJS = scheduleOnRN;

/** @deprecated Use `scheduleOnUI` from `@/core/threads`. */
export const runOnUI = scheduleOnUI;
