import { getOperation, listOperations, mergeParams, runOperation, type ImageBuffer } from '@/engine';
import { ramp } from './fixtures';

/** 8×8 RGB gradient used to smoke-test every operation. */
function fixture(): ImageBuffer {
  return ramp(8, 8);
}

describe('engine registry', () => {
  it('has unique ids and non-empty explanations', () => {
    const operations = listOperations();
    const ids = operations.map((op) => op.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const op of operations) {
      expect(op.name.length).toBeGreaterThan(0);
      expect(op.explain.summary.length).toBeGreaterThan(0);
      expect(op.explain.formula.length).toBeGreaterThan(0);
      expect(op.explain.whenToUse.length).toBeGreaterThan(0);
    }
  });

  it('has unique, valid parameter definitions', () => {
    for (const op of listOperations()) {
      const keys = op.params.map((param) => param.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const param of op.params) {
        expect(param.min).toBeLessThanOrEqual(param.max);
        expect(param.default).toBeGreaterThanOrEqual(param.min);
        expect(param.default).toBeLessThanOrEqual(param.max);
        expect(param.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('runs every operation with defaults on the 8×8 fixture', () => {
    for (const op of listOperations()) {
      const out = op.run(fixture(), mergeParams(op.params));
      expect(out.width).toBe(8);
      expect(out.height).toBe(8);
      expect(out.data.length).toBe(8 * 8 * 4);
    }
  });

  it('looks up operations and rejects unknown ids', () => {
    expect(getOperation('brightness').id).toBe('brightness');
    expect(() => getOperation('nope')).toThrow(/Unknown engine operation/);
    expect(() => runOperation('nope', fixture())).toThrow(/Unknown engine operation/);
  });

  it('fills defaults, clamps ranges and drops unknown params', () => {
    const op = getOperation('brightness');
    expect(mergeParams(op.params, {})).toEqual({ amount: 0 });
    expect(mergeParams(op.params, { amount: 999 })).toEqual({ amount: 100 });
    expect(mergeParams(op.params, { amount: -999 })).toEqual({ amount: -100 });
    expect(mergeParams(op.params, { amount: 12, bogus: 3 })).toEqual({ amount: 12 });
    expect(mergeParams(op.params, { amount: Number.NaN })).toEqual({ amount: 0 });
  });

  it('starts convolution from a spatial identity kernel', () => {
    const op = getOperation('convolve');
    expect(mergeParams(op.params)).toMatchObject({
      m00: 0,
      m01: 0,
      m02: 0,
      m10: 0,
      m11: 1,
      m12: 0,
      m20: 0,
      m21: 0,
      m22: 0,
      border: 0,
    });
    const src = ramp(8, 8);
    expect(runOperation('convolve', src).data).toEqual(src.data);
  });

  it('clamps the public facade input', () => {
    const brightened = runOperation('brightness', fixture(), { amount: 1000 });
    expect(brightened.data[0]).toBe(100); // clamped to the registry max
  });

  it('runs every operation with completely empty params (in-module fallbacks)', () => {
    for (const op of listOperations()) {
      const out = op.run(fixture(), {});
      expect(out.width).toBe(8);
      expect(out.height).toBe(8);
      expect(out.data.length).toBe(8 * 8 * 4);
      expect(out.data.every((value) => value >= 0 && value <= 255)).toBe(true);
    }
  });

  it('computes a finite halo for every op that declares one, even with empty params', () => {
    const halos = listOperations().filter((op) => op.halo !== undefined);
    expect(halos.length).toBeGreaterThan(0);
    for (const op of halos) {
      const halo = op.halo?.({});
      expect(typeof halo).toBe('number');
      expect(halo as number).toBeGreaterThanOrEqual(0);
    }
  });
});
