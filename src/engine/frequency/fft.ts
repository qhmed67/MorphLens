/**
 * fft.ts — iterative radix-2 Cooley–Tukey FFT (1-D and 2-D), quadrant shift
 * and power-of-two zero padding.
 *
 * Theory: the discrete Fourier transform decomposes a length-N signal into
 * N complex exponentials. The Cooley–Tukey recursion splits an even-length
 * transform into two half-length transforms on even/odd samples, giving the
 * fast Fourier transform at O(N log N) instead of O(N²):
 *
 *   X[k] = Σ_{n=0..N−1} x[n]·e^{−2πi·k·n/N}
 *
 * This implementation is the classic in-place iterative form: a bit-reversal
 * permutation followed by log₂(N) butterfly stages of doubling length. The
 * inverse transform is the same butterflies with conjugate twiddles plus a
 * 1/N normalisation, so round-trips return the exact input (±1e-9).
 *
 * `fftShift` rotates spectrum quadrants by 180° (DC to the centre) — for
 * even sizes it is an involution, applying it twice restores the input.
 *
 * `zeroPadPow2` embeds a W×H plane in the top-left of the next power-of-two
 * canvas, which the FFT requires and which also suppresses the circular-
 * convolution wrap-around of frequency-domain filtering.
 *
 * Complexity: 1-D O(N log N); 2-D O(W·H·(log W + log H)).
 * Reference: Oppenheim & Schafer, Discrete-Time Signal Processing —
 * "Efficient Computation of the DFT"; Numerical Recipes, ch. 12 (FFT).
 */

/** Smallest power of two ≥ n (at least 2, the minimum transform length). */
export function nextPow2(n: number): number {
  let p = 2;
  while (p < Math.max(1, Math.ceil(n))) p <<= 1;
  return p;
}

/** In-place 1-D FFT. `im` is modified alongside `re`. */
export function fft1d(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n !== im.length) throw new Error(`fft1d: length mismatch ${n} vs ${im.length}`);
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error(`fft1d: length ${n} is not a power of two`);
  }
  // Bit-reversal permutation: butterfly stage i needs input i in reversed-bit order.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  // log₂(N) butterfly stages; twiddle rotates once per stage length.
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    const half = len >> 1;
    for (let start = 0; start < n; start += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < half; j += 1) {
        const a = start + j;
        const b = a + half;
        const vRe = re[b] * curRe - im[b] * curIm;
        const vIm = re[b] * curIm + im[b] * curRe;
        re[b] = re[a] - vRe;
        im[b] = im[a] - vIm;
        re[a] += vRe;
        im[a] += vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/**
 * In-place 2-D FFT over a width×height row-major plane (rows, then columns).
 * Both dimensions must be powers of two; `re`/`im` must hold width·height values.
 */
export function fft2d(
  width: number,
  height: number,
  re: Float64Array,
  im: Float64Array,
  inverse = false,
): void {
  if (re.length !== width * height || im.length !== width * height) {
    throw new Error(`fft2d: plane size ${re.length}/${im.length} ≠ ${width * height}`);
  }
  // Rows: subarray views make the 1-D pass in-place on the shared buffer.
  for (let y = 0; y < height; y += 1) {
    fft1d(re.subarray(y * width, y * width + width), im.subarray(y * width, y * width + width), inverse);
  }
  // Columns: gather into contiguous scratch, transform, scatter back.
  const colRe = new Float64Array(height);
  const colIm = new Float64Array(height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      colRe[y] = re[y * width + x];
      colIm[y] = im[y * width + x];
    }
    fft1d(colRe, colIm, inverse);
    for (let y = 0; y < height; y += 1) {
      re[y * width + x] = colRe[y];
      im[y * width + x] = colIm[y];
    }
  }
}

/**
 * Rotate spectrum quadrants by 180° so DC moves to the centre (even sizes:
 * an involution). Applies to both the real and imaginary planes.
 */
export function fftShift(width: number, height: number, re: Float64Array, im: Float64Array): void {
  const hw = width >> 1;
  const hh = height >> 1;
  for (let y = 0; y < hh; y += 1) {
    for (let x = 0; x < hw; x += 1) {
      const a = y * width + x;
      const b = (y + hh) * width + (x + hw);
      const tr = re[a];
      re[a] = re[b];
      re[b] = tr;
      const ti = im[a];
      im[a] = im[b];
      im[b] = ti;
    }
  }
}

/** Embed a width×height plane in the top-left of a next-power-of-two canvas. */
export function zeroPadPow2(
  width: number,
  height: number,
  data: Float64Array,
): { width: number; height: number; data: Float64Array } {
  const w2 = nextPow2(width);
  const h2 = nextPow2(height);
  if (w2 === width && h2 === height) {
    return { width, height, data };
  }
  const out = new Float64Array(w2 * h2);
  for (let y = 0; y < height; y += 1) {
    out.set(data.subarray(y * width, y * width + width), y * w2);
  }
  return { width: w2, height: h2, data: out };
}
