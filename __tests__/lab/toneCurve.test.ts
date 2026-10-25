import {
  buildToneLut,
  clampTonePoint,
  TONE_IDENTITY,
  TONE_LIFT,
  toneAt,
} from '@/lab/toneCurve';

describe('tone curve', () => {
  it('builds an identity LUT from the identity points', () => {
    const lut = buildToneLut(TONE_IDENTITY);
    expect(Array.from(lut)).toEqual(Array.from({ length: 256 }, (_, index) => index));
  });

  it('interpolates between control points', () => {
    const lut = buildToneLut(TONE_LIFT);
    expect(lut[0]).toBe(24);
    expect(lut[128]).toBe(140);
    expect(lut[255]).toBe(255);
    expect(lut[64]).toBeGreaterThan(24);
    expect(lut[64]).toBeLessThan(140);
  });

  it('clamps control points and rejects a one-point curve', () => {
    expect(clampTonePoint(-20)).toBe(0);
    expect(clampTonePoint(999)).toBe(255);
    expect(clampTonePoint(Number.NaN)).toBe(0);
    expect(() => buildToneLut([128])).toThrow(/exactly 5/);
  });

  it('samples the same curve used by the LUT', () => {
    for (const value of [0, 32, 64, 128, 200, 255]) {
      expect(toneAt(TONE_LIFT, value)).toBe(buildToneLut(TONE_LIFT)[value]);
    }
  });
});
