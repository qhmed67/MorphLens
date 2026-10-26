/**
 * qa/invariants.test.ts — the rules the app must never break again.
 *
 * These are the regressions the owner actually hit on the device, turned into
 * guards: a "GO_BACK" warning, a screen that is advertised but not there, an
 * operation without an explanation, a stray debug log. They read the source
 * as a QA tester reads the build: from the outside, without trusting it.
 */
import { listOperations } from '@/engine';
import { ARABIC_EXPLAIN } from '@/lab/arabicExplain';

/* The QA sweep reads the source tree directly. Node's `fs`/`path` are used
 * through `require` so the project does not need @types/node (a dev-only
 * dependency the app does not otherwise need). */
declare const require: (name: string) => any;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};
const path = require('path') as { join: (...parts: string[]) => string };

const ROOT = path.join(__dirname, '..', '..');

/** Every .ts/.tsx file under a folder (recursively). */
function sourceFiles(folder: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    readdirSync(current).forEach((entry: string) => {
      if (entry === 'node_modules' || entry.startsWith('.')) return;
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        return;
      }
      if (/\.tsx?$/.test(entry)) out.push(full);
    });
  };
  walk(path.join(ROOT, folder));
  return out;
}

const appFiles = sourceFiles('app');
const srcFiles = sourceFiles('src');

describe('QA invariants', () => {
  it('never calls router.back() directly (it warns when there is no history)', () => {
    const offenders = appFiles
      .concat(srcFiles)
      .filter((file) => !file.includes('core/navigation'))
      .filter((file) => /router\.back\(\)/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('has a screen for every route file under app/', () => {
    const routes = appFiles.filter(
      (file) => !file.endsWith('_layout.tsx') && !file.endsWith('+not-found.tsx'),
    );
    routes.forEach((route) => {
      const source = readFileSync(route, 'utf8');
      expect(source.length).toBeGreaterThan(0);
    });
    expect(routes.length).toBeGreaterThan(5);
  });

  it('explains every registered operation in Arabic', () => {
    const ids = listOperations().map((operation) => operation.id);
    ids.forEach((id) => {
      expect(ARABIC_EXPLAIN[id]).toBeDefined();
    });
    expect(Object.keys(ARABIC_EXPLAIN).length).toBe(ids.length);
  });

  it('keeps debug logs out of the app code', () => {
    const offenders = appFiles
      .concat(srcFiles)
      .filter((file) => /console\.(log|debug|info)\(/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('does not advertise a locked screen in the Lab hub', () => {
    const hub = readFileSync(path.join(ROOT, 'app/lab/index.tsx'), 'utf8');
    expect(hub).not.toContain('LOCKED');
  });

  it('keeps the engine free of UI imports', () => {
    const engineFiles = sourceFiles('src/engine').filter(
      (file) => !file.includes('bridge/skia.ts'),
    );
    const offenders = engineFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        /from 'react'/.test(source) ||
        /from 'react-native'/.test(source) ||
        /react-native-reanimated/.test(source) ||
        /@shopify\/react-native-skia/.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });
});
