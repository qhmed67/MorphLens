import { getOperation } from '@/engine';

/** The convolution kernel is always 3×3: nine weights, row-major. */
export const KERNEL_SIZE = 3;
export const KERNEL_WEIGHTS = KERNEL_SIZE * KERNEL_SIZE;

/**
 * The nine registry defaults for the convolution weights.
 *
 * The registry also carries a `border` param in the same list; including it
 * here would give the editor a phantom tenth weight (`m30`) and make the
 * Identity preset appear inactive. Keep the UI to the 3×3 matrix only.
 */
export function defaultConvolveWeights(): number[] {
  return getOperation('convolve')
    .params.filter((param) => param.key !== 'border')
    .map((param) => param.default);
}

/**
 * Parse a kernel-weight text field.
 *
 * An empty field must NOT become `Number('') === 0`: blurring a cleared centre
 * cell used to zero the kernel and turn the whole convolution preview black
 * when the user tapped a border option. Invalid input also reverts. Valid
 * values are clamped to the registry's [-8, 8] domain so the numbers shown in
 * the editor match the numbers the engine receives.
 */
export function parseKernelWeight(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(8, Math.max(-8, parsed));
}

/**
 * Registry parameters for one convolution: nine row-major weights plus the
 * numeric border mode.
 *
 * The kernel is always 3×3. A longer weight list (a 7×7 Gaussian, say) would
 * be mapped onto the first nine cells and produce an almost-zero kernel, which
 * renders the whole preview black — so anything longer is rejected here
 * instead of being silently mis-mapped.
 */
export function convolveParams(weights: number[], border: number): Record<string, number> {
  if (weights.length !== KERNEL_WEIGHTS) {
    throw new Error(
      `A convolution kernel needs exactly ${KERNEL_WEIGHTS} weights, received ${weights.length}`,
    );
  }
  const params: Record<string, number> = { border };
  weights.forEach((weight, index) => {
    params[`m${Math.floor(index / KERNEL_SIZE)}${index % KERNEL_SIZE}`] = weight;
  });
  return params;
}
