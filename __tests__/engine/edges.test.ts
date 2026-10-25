import {
  canny,
  cannyStages,
  createImageBuffer,
  EngineCancelledError,
  getPixel,
  prewittEdges,
  sobelEdges,
  type ImageBuffer,
} from '@/engine';
import { constant as constantFixture, ramp, verticalStep as stepFixture } from './fixtures';

/** Count nonzero pixels in one column across every row. */
function columnEdgeCount(img: ImageBuffer, x: number): number {
  let count = 0;
  for (let y = 0; y < img.height; y += 1) {
    if (getPixel(img, x, y)[0] > 0) count += 1;
  }
  return count;
}

describe('sobelEdges', () => {
  it('is black on a flat image (sobel-flat ⇒ 0)', () => {
    const out = sobelEdges(constantFixture(16, 128), { threshold: 0 });
    expect(Array.from(out.data).every((v, i) => (i % 4 === 3 ? v === 255 : v === 0))).toBe(true);
  });

  it('peaks at 180 for a full 0→255 step (4·255 / (4·√2))', () => {
    const out = sobelEdges(stepFixture(64, 64, 0, 255), { threshold: 0 });
    // Both columns straddling the boundary see the full 0↔255 difference.
    expect(getPixel(out, 31, 32)[0]).toBe(180);
    expect(getPixel(out, 32, 32)[0]).toBe(180);
    expect(getPixel(out, 30, 32)[0]).toBe(0); // one column away: no gradient
    expect(getPixel(out, 5, 5)[0]).toBe(0); // flat far field
  });

  it('drops the step edge when the threshold exceeds its magnitude', () => {
    const weak = sobelEdges(stepFixture(64, 64, 0, 255), { threshold: 190 });
    const strong = sobelEdges(stepFixture(64, 64, 0, 255), { threshold: 150 });
    expect(getPixel(weak, 31, 32)[0]).toBe(0);
    expect(getPixel(strong, 31, 32)[0]).toBe(180);
  });

  it('throws when cancelled', () => {
    expect(() => sobelEdges(stepFixture(16, 16, 0, 1), {}, { shouldCancel: () => true })).toThrow(
      EngineCancelledError,
    );
  });
});

describe('prewittEdges', () => {
  it('peaks at 180 for a full step — same normalised response as Sobel', () => {
    const out = prewittEdges(stepFixture(64, 64, 0, 255), { threshold: 0 });
    // Gx = 3·255, scaled by 1/(3·√2) → 255/√2 = 180.3 → 180, identical to
    // Sobel's by construction (each is divided by its own max weight sum).
    expect(getPixel(out, 31, 32)[0]).toBe(180);
  });
});

describe('canny', () => {
  it('is black on a flat image', () => {
    const out = canny(constantFixture(16, 128), { sigma: 1.4, low: 0.1, high: 0.3 });
    expect(Array.from(out.data).every((v, i) => (i % 4 === 3 ? v === 255 : v === 0))).toBe(true);
  });

  it('confines a step edge to a thin band around the boundary', () => {
    const out = canny(stepFixture(64, 64, 0, 255), { sigma: 1.4, low: 0.1, high: 0.3 });
    expect(columnEdgeCount(out, 31) + columnEdgeCount(out, 32)).toBeGreaterThanOrEqual(62);
    // Nothing far from the boundary.
    for (const x of [0, 5, 20, 45, 60, 63]) {
      expect(columnEdgeCount(out, x)).toBe(0);
    }
  });

  it('lets hysteresis delete a faint edge that survives NMS', () => {
    // Flat 120 background; strong 255 stripe at x∈[16,20) (Δ=135 → raw
    // magnitude ≈309); faint 140 stripe at x∈[48,50) (Δ=20 → ≈29, which is
    // above low·max=15 but below high·max=93).
    const img = createImageBuffer(64, 64, [120, 120, 120, 255]);
    for (let y = 0; y < 64; y += 1) {
      for (let x = 16; x < 20; x += 1) {
        const o = (y * 64 + x) * 4;
        img.data[o] = 255;
        img.data[o + 1] = 255;
        img.data[o + 2] = 255;
      }
      for (let x = 48; x < 50; x += 1) {
        const o = (y * 64 + x) * 4;
        img.data[o] = 140;
        img.data[o + 1] = 140;
        img.data[o + 2] = 140;
      }
    }
    const stages = cannyStages(img, { sigma: 1.4, low: 0.05, high: 0.3 });
    // The faint ridge is above low·max → kept by NMS…
    expect(getPixel(stages.nonMax, 47, 32)[0]).toBeGreaterThan(0);
    // …but it is below high·max and disconnected → hysteresis drops it.
    expect(getPixel(stages.edges, 47, 32)[0]).toBe(0);
    // The strong edge survives the full pipeline.
    expect(getPixel(stages.edges, 15, 32)[0]).toBe(255);
  });

  it('exposes blur, magnitude, nonMax and edges at the same size', () => {
    const src = ramp(16, 16);
    const stages = cannyStages(src, {});
    for (const stage of [stages.blur, stages.magnitude, stages.nonMax, stages.edges]) {
      expect(stage.width).toBe(16);
      expect(stage.height).toBe(16);
    }
  });

  it('throws when cancelled', () => {
    expect(() =>
      cannyStages(stepFixture(32, 32, 0, 200), {}, { shouldCancel: () => true }),
    ).toThrow(EngineCancelledError);
  });
});
