export type UnitSystem = "us" | "metric";

export interface Ingredient {
  /** Lower bound (or only value). null when no amount, e.g. "salt to taste". */
  quantity: number | null;
  /** Upper bound for ranges such as "2-3 cloves". */
  quantityMax?: number | null;
  /** Canonical unit key (see units.ts) or null for counted items. */
  unit: string | null;
  name: string;
  note?: string;
  /** false for "to taste", "pinch", etc. */
  scalable: boolean;
}

export interface Step {
  text: string;
}

export interface ImageCredit {
  name: string;
  /** Link to the photo or the photographer's page. */
  url?: string;
  /** pexels / unsplash: picked with Find a picture. other: typed in for a pasted picture. */
  source: "pexels" | "unsplash" | "other";
  /** Licence for pasted pictures, e.g. "CC BY". */
  license?: string;
}

export interface Recipe {
  id?: string;
  title: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  /** Photographer credit when the picture came from a photo site. */
  imageCredit?: ImageCredit | null;
  /** Number of servings the ingredient list was written for. */
  baseServings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  notes?: string;
  rating?: number | null;
  favorite?: boolean;
}

export const DEFAULT_SERVINGS = 2;
