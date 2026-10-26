import { defaultConvolveWeights, parseKernelWeight } from '@/lab/kernelInput';

describe('defaultConvolveWeights', () => {
  it('returns the nine spatial identity weights, not the border param', () => {
    expect(defaultConvolveWeights()).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });
});

describe('parseKernelWeight', () => {
  it('rejects empty and invalid input instead of turning it into zero', () => {
    expect(parseKernelWeight('')).toBeNull();
    expect(parseKernelWeight('   ')).toBeNull();
    expect(parseKernelWeight('abc')).toBeNull();
    expect(parseKernelWeight('-')).toBeNull();
    expect(parseKernelWeight('.')).toBeNull();
  });

  it('accepts decimals and clamps to the registry domain', () => {
    expect(parseKernelWeight('2.5')).toBe(2.5);
    expect(parseKernelWeight(' -3 ')).toBe(-3);
    expect(parseKernelWeight('99')).toBe(8);
    expect(parseKernelWeight('-99')).toBe(-8);
  });
});
