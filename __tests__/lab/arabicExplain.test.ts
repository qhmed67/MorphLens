/**
 * The owner's Arabic revision: every filter gets its own idea, not a shared
 * symbol glossary. This guard fails if a new operation ships without one.
 */
import { listOperations } from '@/engine';
import { ARABIC_EXPLAIN, getArabicExplain } from '@/lab/arabicExplain';

describe('Arabic operation explanations', () => {
  it('covers every registered operation', () => {
    for (const operation of listOperations()) {
      expect(getArabicExplain(operation.id)).not.toBeNull();
    }
  });

  it('has no orphaned entries', () => {
    const ids = new Set(listOperations().map((operation) => operation.id));
    for (const id of Object.keys(ARABIC_EXPLAIN)) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('keeps every idea short and every explanation concrete', () => {
    for (const [id, entry] of Object.entries(ARABIC_EXPLAIN)) {
      expect(entry.idea.trim().length).toBeGreaterThan(10);
      expect(entry.idea.length).toBeLessThanOrEqual(180);
      expect(entry.points.length).toBeGreaterThanOrEqual(1);
      entry.points.forEach((point) => expect(point.trim().length).toBeGreaterThan(8));
      if (entry.tryThis) expect(entry.tryThis.trim().length).toBeGreaterThan(8);
      expect(id).not.toHaveLength(0);
    }
  });

  it('tells the pixel → edge → sharpen story for unsharp masking', () => {
    const sharpen = getArabicExplain('unsharpMask');
    expect(sharpen).not.toBeNull();
    expect(sharpen?.idea).toContain('الفرق');
    expect(sharpen?.points.join(' ')).toContain('0');
    expect(sharpen?.points.join(' ')).toContain('255');
  });
});
