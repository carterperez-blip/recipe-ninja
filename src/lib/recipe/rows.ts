import type { Ingredient, Recipe } from "./types";

/** Database row shape of public.recipes (see supabase/schema.sql). */
export interface RecipeRow {
  id: string;
  title: string;
  source_url: string | null;
  image_url: string | null;
  base_servings: number | string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: Ingredient[];
  steps: { text: string }[];
  tags: string[];
  notes: string | null;
  rating: number | null;
  favorite: boolean;
}

export function toRow(r: Recipe & { id: string }): RecipeRow {
  return {
    id: r.id,
    title: r.title,
    source_url: r.sourceUrl ?? null,
    image_url: r.imageUrl ?? null,
    base_servings: r.baseServings,
    prep_minutes: r.prepMinutes ?? null,
    cook_minutes: r.cookMinutes ?? null,
    ingredients: r.ingredients,
    steps: r.steps,
    tags: r.tags,
    notes: r.notes ?? "",
    rating: r.rating ?? null,
    favorite: !!r.favorite,
  };
}

export function fromRow(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    baseServings: Number(row.base_servings),
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    notes: row.notes ?? "",
    rating: row.rating,
    favorite: row.favorite,
  };
}
