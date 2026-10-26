/**
 * Shared, UI-agnostic types. Kept free of React/Reanimated/Skia imports so the
 * engine and the stores can depend on it without pulling in the UI layer.
 */

export type Vec2 = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** A numeric parameter exposed by an engine operation or a Creative filter. */
export type ParamDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
};

/** One non-destructive engine step stored in a recipe. */
export type RecipeOp = { id: string; params: Record<string, number> };

/** Persisted, non-destructive edit description (architecture.md §5.2). */
export type Recipe = {
  id: string;
  createdAt: number;
  originalUri: string;
  previewUri: string;
  thumbUri: string;
  size: Size;
  adjust: { exposure: number; contrast: number; saturation: number };
  filterId: string | null;
  params: Record<string, number>;
  amount: number;
  origin: { x: number; y: number };
  ops?: RecipeOp[];
  version: 1;
};
