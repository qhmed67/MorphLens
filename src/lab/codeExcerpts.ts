/**
 * codeExcerpts.ts — the Python excerpts shown by the Trace "Code" tab.
 *
 * The course is taught in Python, so the "Code" tab shows the same step the
 * engine performs, written in Python. These are *teaching snippets*: the point
 * is to show the step that changes the pixel, not to duplicate the
 * production TypeScript. The app's own code stays TypeScript — only the
 * excerpt shown to the reader is Python.
 *
 * When an algorithm changes, update the matching excerpt;
 * `__tests__/lab/stages.test.ts` fails if a traceable op has no excerpt, so the
 * two cannot silently drift apart by omission.
 */
export const CODE_EXCERPTS: Record<string, string> = {
  unsharpMask: `# engine/enhance/sharpen.py
blur = gaussian_filter(src, sigma=radius)
for i in range(0, len(src), 4):
    # add the high-frequency residual back on top of the original
    out[i]     = clamp_byte(src[i]     + amount * (src[i]     - blur[i]))
    out[i + 1] = clamp_byte(src[i + 1] + amount * (src[i + 1] - blur[i + 1]))
    out[i + 2] = clamp_byte(src[i + 2] + amount * (src[i + 2] - blur[i + 2]))`,

  meanFilter: `# engine/noise/denoise.py
k = odd_window(params.get("k", 3), 3, 9)
half = (k - 1) // 2
for y in range(height):
    for x in range(width):
        total = 0.0
        for ky in range(k):
            for kx in range(k):
                total += sample(x + kx - half, y + ky - half)
        out[pixel(x, y)] = total / (k * k)   # box average`,

  gaussianFilter: `# engine/noise/denoise.py
sigma = clamp(params.get("sigma", 1.4), 0.5, 5)
radius = int(clamp(ceil(3 * sigma), 1, 10))
kernel = gaussian_kernel_1d(sigma, 2 * radius + 1)
# separable: one horizontal pass, then one vertical pass — O(k), not O(k^2)
return separable_convolve(src, kernel, kernel, border)`,

  medianFilter: `# engine/noise/denoise.py
counts = [0] * 256              # one histogram per channel
for ky in range(k):
    for kx in range(k):
        counts[sample(x + kx - half, y + ky - half)] += 1
# walk the counts until half of the window is behind us -> lower median
seen = 0
value = 0
while seen + counts[value] <= total / 2:
    seen += counts[value]
    value += 1`,

  adaptiveMedian: `# engine/noise/denoise.py
k = 3
while k <= k_max:
    smallest, largest, median = window_stats(x, y, k)
    z = pixel(x, y)
    # if the current pixel is an outlier, grow the window
    if smallest < median < largest:
        if smallest < z < largest:
            return z            # keep the original
        return median           # replace with the median
    k += 2
return median_at(x, y, k_max)  # window cap reached`,

  bilateralFilter: `# engine/noise/denoise.py
def spatial(dx, dy):
    return exp(-(dx * dx + dy * dy) / (2 * sigma_spatial ** 2))

def range_weight(d):
    return exp(-(d * d) / (2 * sigma_range ** 2))

for ky in range(-radius, radius + 1):
    for kx in range(-radius, radius + 1):
        w = spatial(kx, ky) * range_weight(abs(luma(neighbour) - luma(centre)))
        total += neighbour * w      # keep the edges
        weight += w
out[pixel(x, y)] = total / weight`,

  noiseGaussian: `# engine/noise/generate.py
rng = mulberry32(seed)            # deterministic: same seed, same pixels
for i in range(0, len(src), 4):
    for c in range(3):
        src[i + c] = clamp_byte(src[i + c] + sigma * normal(rng))`,

  noiseSaltPepper: `# engine/noise/generate.py
for i in range(0, len(src), 4):
    if rng() < probability / 2:
        src[i] = src[i + 1] = src[i + 2] = 255   # salt
    elif rng() < probability:
        src[i] = src[i + 1] = src[i + 2] = 0     # pepper`,

  noiseSpeckle: `# engine/noise/generate.py
for i in range(0, len(src), 4):
    for c in range(3):
        src[i + c] = clamp_byte(src[i + c] * (1 + sigma * normal(rng)))`,

  sobelEdges: `# engine/spatial/edges.py
for y in range(height):
    for x in range(width):
        gx = 0.0
        gy = 0.0
        for ky in range(3):
            for kx in range(3):
                value = luma(sample(x + kx - 1, y + ky - 1))
                gx += sobel_x[ky][kx] * value    # vertical edges
                gy += sobel_y[ky][kx] * value    # horizontal edges
        out[pixel(x, y)] = clamp_byte(hypot(gx, gy))`,

  canny: `# engine/spatial/edges.py
blur = gaussian_filter(src, sigma=sigma)
grad_x, grad_y = sobel_gradients(blur)
magnitude, angle = hypot(grad_x, grad_y), atan2(grad_y, grad_x)
thin = non_max_suppress(magnitude, angle)   # one pixel wide edges
low = thin < low_threshold
high = thin < high_threshold
out = hysteresis(thin, low, high)           # keep weak edges joined to strong ones`,

  equalize: `# engine/enhance/histogram.py
histogram = [0] * 256
for i in range(0, len(src), 4):
    histogram[luma(src[i], src[i + 1], src[i + 2])] += 1

cdf, running = [0.0] * 256, 0
for value in range(256):
    running += histogram[value]
    cdf[value] = running / total_pixels     # cumulative distribution

for i in range(0, len(src), 4):
    y = luma(src[i], src[i + 1], src[i + 2])
    target = round(255 * cdf[y])             # the new level
    shift = target - y
    src[i] = clamp_byte(src[i] + shift)     # same shift for R, G, B`,

  contrastStretch: `# engine/enhance/stretch.py
lowest, highest = 255, 0
for i in range(0, len(src), 4):
    y = luma(src[i], src[i + 1], src[i + 2])
    lowest, highest = min(lowest, y), max(highest, y)

scale = 255 / (highest - lowest) if highest > lowest else 0
for i in range(0, len(src), 4):
    out[i] = clamp_byte((src[i] - lowest) * scale)`,

  clahe: `# engine/enhance/clahe.py
for tile_y in range(tiles):
    for tile_x in range(tiles):
        hist = tile_histogram(src, tile_x, tile_y)
        limit = clip * tile_pixels / 256       # clip the peaks
        excess = clip_peaks(hist, limit)
        redistribute(hist, excess)             # spread over the bins
        lut = build_cdf_lut(hist)              # one map per tile
for y in range(height):
    for x in range(width):
        out[pixel(x, y)] = bilinear(luts, x, y)  # blend the four tiles`,

  grayscale: `# engine/color/spaces.py
for i in range(0, len(src), 4):
    y = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
    src[i] = src[i + 1] = src[i + 2] = y`,

  invert: `# engine/color/effects.py
for i in range(0, len(src), 4):
    src[i]     = 255 - src[i]
    src[i + 1] = 255 - src[i + 1]
    src[i + 2] = 255 - src[i + 2]`,

  sepia: `# engine/color/effects.py
for i in range(0, len(src), 4):
    r, g, b = src[i], src[i + 1], src[i + 2]
    src[i]     = clamp_byte(0.393 * r + 0.769 * g + 0.189 * b)
    src[i + 1] = clamp_byte(0.349 * r + 0.686 * g + 0.168 * b)
    src[i + 2] = clamp_byte(0.272 * r + 0.534 * g + 0.131 * b)`,

  posterize: `# engine/color/effects.py
levels = max(2, params.get("levels", 6))
step = 255 / (levels - 1)
for i in range(0, len(src), 4):
    for c in range(3):
        src[i + c] = clamp_byte(round(src[i + c] / step) * step)`,

  brightness: `# engine/color/adjust.py
for i in range(0, len(src), 4):
    for c in range(3):
        src[i + c] = clamp_byte(src[i + c] + amount)   # amount in -100..100`,

  contrast: `# engine/color/adjust.py
for i in range(0, len(src), 4):
    for c in range(3):
        value = src[i + c]
        src[i + c] = clamp_byte((value - 128) * factor + 128)  # around mid grey`,

  gamma: `# engine/color/adjust.py
table = [clamp_byte(255 * (v / 255) ** (1 / gamma)) for v in range(256)]
for i in range(0, len(src), 4):
    for c in range(3):
        src[i + c] = table[src[i + c]]   # a lookup, not a per-pixel power`,

  saturation: `# engine/color/adjust.py
for i in range(0, len(src), 4):
    y = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
    for c in range(3):
        src[i + c] = clamp_byte(y + (src[i + c] - y) * amount)`,
};

/** The excerpt for an operation, or null when it has no code demo. */
export function codeExcerpt(opId: string): string | null {
  return CODE_EXCERPTS[opId] ?? null;
}
