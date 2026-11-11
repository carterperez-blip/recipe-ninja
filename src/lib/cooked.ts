import type { Recipe } from "@/lib/recipe/types";

/** One time a recipe was cooked. At most one per recipe per day. */
export interface CookedEntry {
  id: string;
  recipeId: string;
  /** Calendar day as YYYY-MM-DD. */
  day: string;
  /** How many people it was cooked for, when known. */
  servings: number | null;
}

export interface CookedStats {
  count: number;
  /** Most recent day it was cooked (YYYY-MM-DD). */
  last: string;
}

/** Cooked count and last day per recipe, ignoring entries for recipes that no longer exist. */
export function statsByRecipe(entries: CookedEntry[], recipes: Recipe[]): Map<string, CookedStats> {
  const ids = new Set(recipes.map((r) => r.id));
  const out = new Map<string, CookedStats>();
  for (const e of entries) {
    if (!ids.has(e.recipeId)) continue;
    const cur = out.get(e.recipeId);
    out.set(e.recipeId, { count: (cur?.count ?? 0) + 1, last: cur && cur.last > e.day ? cur.last : e.day });
  }
  return out;
}

export const findCooked = (entries: CookedEntry[], recipeId: string, day: string) =>
  entries.find((e) => e.recipeId === recipeId && e.day === day);

/** A recipe's history, newest first. */
export const historyFor = (entries: CookedEntry[], recipeId: string) =>
  entries.filter((e) => e.recipeId === recipeId).sort((a, b) => b.day.localeCompare(a.day));

/** "Nov 2", or "Nov 2, 2025" when it is not this year. `today` is passed in so tests stay exact. */
export function shortDate(iso: string, today: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

/** "Cooked 4 times · last on Nov 2", or "Not cooked yet". */
export function cookedSummary(s: CookedStats | undefined, today: string): string {
  if (!s) return "Not cooked yet";
  return `Cooked ${s.count} ${s.count === 1 ? "time" : "times"} · last on ${shortDate(s.last, today)}`;
}

export type SortMode = "newest" | "most" | "longest" | "az";
export const SORT_LABELS: Record<SortMode, string> = {
  newest: "Newest first",
  most: "Most cooked",
  longest: "Not cooked in a while",
  az: "A to Z",
};

/** Sort recipes. "Not cooked in a while" puts never-cooked recipes first, then oldest last-cooked. */
export function sortRecipes(recipes: Recipe[], mode: SortMode, stats: Map<string, CookedStats>): Recipe[] {
  const list = [...recipes];
  const cmpTitle = (a: Recipe, b: Recipe) => a.title.localeCompare(b.title);
  if (mode === "az") return list.sort(cmpTitle);
  if (mode === "most") return list.sort((a, b) => (stats.get(b.id!)?.count ?? 0) - (stats.get(a.id!)?.count ?? 0) || cmpTitle(a, b));
  if (mode === "longest")
    return list.sort((a, b) => (stats.get(a.id!)?.last ?? "").localeCompare(stats.get(b.id!)?.last ?? "") || cmpTitle(a, b));
  return list; // newest: the order the store already keeps
}

/** Database row shape of public.cooked_log. */
export interface CookedRow {
  id: string;
  recipe_id: string;
  cooked_on: string;
  servings: number | string | null;
}
export const cookedToRow = (e: CookedEntry): CookedRow => ({ id: e.id, recipe_id: e.recipeId, cooked_on: e.day, servings: e.servings });
export const cookedFromRow = (r: CookedRow): CookedEntry => ({
  id: r.id,
  recipeId: r.recipe_id,
  day: String(r.cooked_on).slice(0, 10),
  servings: r.servings === null || r.servings === undefined ? null : Number(r.servings),
});
