import {
  boxKernel,
  convolve,
  createKernel,
  embossKernel,
  EngineCancelledError,
  gaussianKernel,
  gaussianKernel1D,
  getPixel,
  identityKernel,
  laplacianKernel,
  logKernel,
  prewittKernel,
  separableConvolve,
  sharpenKernel,
  sobelKernel,
} from '@/engine';
import { checkerboard, constant, known3x3 } from './fixtures';

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe('kernels', () => {
  it('validates shape', () => {
    expect(() => createKernel(2, [1, 2, 3, 4])).toThrow(/odd/);
    expect(() => createKernel(3, [1])).toThrow(/weights/);
    expect(identityKernel(3).weights[4]).toBe(1);
  });

  it('normalises smoothing kernels', () => {
    expect(sum(boxKernel(5).weights)).toBeCloseTo(1, 12);
    expect(sum(gaussianKernel(1.4).weights)).toBeCloseTo(1, 12);
    expect(sum(gaussianKernel1D(2).weights)).toBeCloseTo(1, 12);
    expect(sum(sharpenKernel().weights)).toBeCloseTo(1, 12);
  });

  it('builds zero-sum derivative kernels', () => {
    expect(sum(laplacianKernel('4').weights)).toBe(0);
    expect(sum(laplacianKernel('8').weights)).toBe(0);
    expect(sum(logKernel(1.4).weights)).toBeCloseTo(0, 12);
    expect(sum(embossKernel().weights)).toBe(0);
    expect(sobelKernel('x').weights).toEqual([-1, 0, 1, -2, 0, 2, -1, 0, 1]);
    expect(prewittKernel('y').weights).toEqual([-1, -1, -1, 0, 0, 0, 1, 1, 1]);
  });
});

describe('convolve', () => {
  it('is identity for the identity kernel', () => {
    const src = checkerboard(6, 6);
    expect(convolve(src, identityKernel()).data).toEqual(src.data);
  });

  it('leaves a constant image constant under a box blur', () => {
    const src = constant(8, 128);
    const out = convolve(src, boxKernel(3));
    expect(Array.from(out.data).every((v, i) => (i % 4 === 3 ? v === 255 : v === 128))).toBe(true);
  });

  it('matches a hand-computed Prewitt x response', () => {
    // 3×3 values 1..9; centre response with zero border = (3−1)+(6−4)+(9−7) = 6.
    const out = convolve(known3x3(), prewittKernel('x'), 'zero');
    expect(getPixel(out, 1, 1)[0]).toBe(6);
  });

  it('preserves alpha and shape', () => {
    const src = constant(4, 50);
    src.data[3] = 123;
    const out = convolve(src, sharpenKernel());
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    expect(out.data[3]).toBe(123);
  });

  it('supports cancel and progress', () => {
    const progress: number[] = [];
    expect(() =>
      convolve(known3x3(), boxKernel(3), 'clamp', {
        onProgress: (p) => progress.push(p),
        shouldCancel: () => true,
      }),
    ).toThrow(EngineCancelledError);
    expect(() =>
      convolve(known3x3(), boxKernel(3), 'clamp', { onProgress: (p) => progress.push(p) }),
    ).not.toThrow();
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('agrees with the separable Gaussian within ±1', () => {
    const src = checkerboard(9, 9);
    const full = convolve(src, gaussianKernel(1.2), 'clamp');
    const sep = separableConvolve(src, gaussianKernel1D(1.2), gaussianKernel1D(1.2), 'clamp');
    for (let i = 0; i < full.data.length; i += 1) {
      if (i % 4 === 3) continue;
      expect(Math.abs(full.data[i] - sep.data[i])).toBeLessThanOrEqual(1);
    }
  });

  it('rejects 2-D kernels in the separable path', () => {
    expect(() => separableConvolve(constant(4, 10), boxKernel(3), boxKernel(3))).toThrow(/1-D/);
  });
});
