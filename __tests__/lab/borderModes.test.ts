import { BORDER_INFO, BORDER_LABELS, BORDER_OUTSIDE, isIdentityKernel } from '@/lab/borderModes';

describe('border mode examples', () => {
  it('lists the modes in registry order', () => {
    expect(BORDER_INFO.map((info) => info.label)).toEqual([...BORDER_LABELS]);
  });

  it('shows averages that match the 3×3 matrices', () => {
    for (const info of BORDER_INFO) {
      const sum = info.values.reduce((total, row) => total + row.reduce((a, b) => a + b, 0), 0);
      expect(Math.round(sum / 9)).toBe(info.result);
    }
  });

  it('keeps the inside 2×2 corner pixels identical across modes', () => {
    for (const info of BORDER_INFO) {
      expect([info.values[1].slice(1), info.values[2].slice(1)]).toEqual([
        [40, 80],
        [60, 90],
      ]);
    }
  });

  it('marks the top row and left column as outside the image', () => {
    expect(BORDER_OUTSIDE).toEqual([
      [true, true, true],
      [true, false, false],
      [true, false, false],
    ]);
  });
});

describe('isIdentityKernel', () => {
  it('detects the spatial identity kernel', () => {
    expect(isIdentityKernel([0, 0, 0, 0, 1, 0, 0, 0, 0])).toBe(true);
  });

  it('rejects any kernel that reads a neighbour', () => {
    expect(isIdentityKernel([1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(false);
    expect(isIdentityKernel([0, 0, 0, 0, 2, 0, 0, 0, 0])).toBe(false);
    expect(isIdentityKernel([0, 0, 0, 1, 1, 0, 0, 0, 0])).toBe(false);
  });

  it('rejects a wrong-sized kernel', () => {
    expect(isIdentityKernel([1])).toBe(false);
    expect(isIdentityKernel([0, 0, 0, 0, 1, 0, 0, 0, 0, 0])).toBe(false);
  });
});
