/**
 * The Convolution Explainer's kernel editor had a silent failure: the "Blur"
 * preset handed the engine a 7×7 Gaussian (49 weights) while the editor and
 * the engine are 3×3, so the first nine cells were mapped onto the matrix,
 * the kernel summed to ~0 and the whole preview turned black.
 *
 * These tests pin the fix: every preset is 3×3, a blur keeps the picture
 * bright, and a wrong-sized kernel is rejected instead of mis-mapped.
 */
import {
  embossKernel,
  gaussianKernel3x3,
  runOperation,
  sharpenKernel,
  sobelKernel,
} from '@/engine';
import { convolveParams, KERNEL_WEIGHTS } from '@/lab/kernelInput';
import { makeSyntheticSource } from '@/lab/source';

/** The presets the KernelEditor offers, mirroring its own list. */
const PRESET_WEIGHTS: Record<string, number[]> = {
  identity: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  blur: Array.from(gaussianKernel3x3(1).weights),
  sharpen: Array.from(sharpenKernel().weights),
  sobel: Array.from(sobelKernel('x').weights),
  emboss: Array.from(embossKernel().weights),
};

describe('kernel presets', () => {
  it('are all 3×3 (nine weights)', () => {
    Object.entries(PRESET_WEIGHTS).forEach(([id, weights]) => {
      expect([id, weights.length]).toEqual([id, KERNEL_WEIGHTS]);
    });
  });

  it('build a 3×3 Gaussian that sums to one', () => {
    const kernel = gaussianKernel3x3(1);
    expect(kernel.size).toBe(3);
    const sum = kernel.weights.reduce((total, weight) => total + weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('keep the picture bright when a blur is applied', () => {
    const src = makeSyntheticSource(64);
    const params = convolveParams(PRESET_WEIGHTS.blur, 0);
    const out = runOperation('convolve', src, params);
    let min = 255;
    let max = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      min = Math.min(min, out.data[i]);
      max = Math.max(max, out.data[i]);
    }
    expect(max).toBeGreaterThan(120);
    expect(min).toBeLessThan(255);
  });

  it('rejects a kernel that is not 3×3 instead of mis-mapping it', () => {
    expect(() => convolveParams(new Array(49).fill(0.01), 0)).toThrow(/exactly 9/);
  });

  it('maps the nine weights onto the registry keys in row-major order', () => {
    const params = convolveParams([1, 2, 3, 4, 5, 6, 7, 8, 9], 2);
    expect(params.m00).toBe(1);
    expect(params.m12).toBe(6);
    expect(params.m22).toBe(9);
    expect(params.border).toBe(2);
  });
});
