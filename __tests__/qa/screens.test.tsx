/**
 * qa/screens.test.tsx — the QA sweep.
 *
 * Every screen is mounted, its title is checked, and it is unmounted again.
 * The engine is real, so the pipelines actually run on the synthetic scene:
 * a screen that throws in an effect, or one that never paints, fails here.
 *
 * This is deliberately an *outside* test: it only uses the public surface
 * (render → assert → unmount), the way a QA tester would drive the app.
 * A console error during the run fails the case — that is how the "GO_BACK
 * was not handled" warning and similar regressions are caught.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import './mocks';

import HomeScreen from '../../app/index';
import LabIndex from '../../app/lab/index';
import ConvolutionRoute from '../../app/lab/convolution';
import DenoiseRoute from '../../app/lab/denoise';
import HistogramRoute from '../../app/lab/histogram';
import EnhanceRoute from '../../app/lab/enhance';
import ExplainRoute from '../../app/explain/[op]';

type Case = {
  name: string;
  render: () => Promise<Awaited<ReturnType<typeof render>>>;
  /** Text that must be on screen. */
  expectText: string;
  /** More text that must be on screen (the screen's own controls). */
  expectAlso?: string[];
};

const CASES: Case[] = [
  {
    name: 'Home',
    render: async () => render(<HomeScreen />),
    expectText: 'MorphLens',
    expectAlso: ['Lab mode', 'Edit a photo'],
  },
  {
    name: 'Lab hub',
    render: async () => render(<LabIndex />),
    expectText: 'Algorithm Theatre',
    expectAlso: ['Convolution Explainer', 'Denoise Arena', 'Histogram Surgery', 'Enhance Studio'],
  },
  {
    name: 'Convolution Explainer',
    render: async () => render(<ConvolutionRoute />),
    expectText: 'Convolution Explainer',
  },
  {
    name: 'Denoise Arena',
    render: async () => render(<DenoiseRoute />),
    expectText: 'Denoise Arena',
    expectAlso: ['Mean', 'Median'],
  },
  {
    name: 'Histogram Surgery',
    render: async () => render(<HistogramRoute />),
    expectText: 'Histogram Surgery',
    expectAlso: ['Equalize', 'CLAHE'],
  },
  {
    name: 'Enhance Studio',
    render: async () => render(<EnhanceRoute />),
    expectText: 'Enhance Studio',
    expectAlso: ['Result', 'Auto enhance'],
  },
  { name: 'Trace', render: async () => render(<ExplainRoute />), expectText: 'Trace' },
];

describe('QA sweep — every screen mounts, shows its title and unmounts', () => {
  it.each(CASES)('$name mounts and unmounts cleanly', async (testCase) => {
    const errors: unknown[][] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });

    try {
      const view = await testCase.render();
      await waitFor(() => {
        expect(screen.getByText(testCase.expectText)).toBeTruthy();
      });
      (testCase.expectAlso ?? []).forEach((label) => {
        // A label can legitimately appear more than once (a chip and a
        // button); the sweep only cares that it is on screen.
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      });
      await view.unmount();
    } finally {
      spy.mockRestore();
    }

    // The engine pipelines keep running for a moment after the mount; give
    // them a tick to settle so a late error is still caught.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(errors).toEqual([]);
  });
});
