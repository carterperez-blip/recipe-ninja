import type { Ingredient, UnitSystem } from "./types";
import { agreeWithAmount, singularize } from "./inflect";
import { displayIngredient } from "./scale";
import { GRAMS, ML } from "./units";

export interface GroceryItem {
  id: string;
  /** Item name without amounts, e.g. "all-purpose flour". */
  name: string;
  /** null for items with no amount ("salt", "paper towels"). */
  quantity: number | null;
  /** Canonical unit key (see units.ts) or null for counted items. */
  unit: string | null;
  checked: boolean;
  /** Titles of the recipes this item is for. */
  recipes: string[];
  createdAt: string;
}

export type GroceryDraft = Pick<GroceryItem, "name" | "quantity" | "unit"> & { recipe?: string };

/** Name used to decide whether two items are the same thing. */
export function normalizeName(name: string): string {
  const parts = name.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  parts[parts.length - 1] = singularize(parts[parts.length - 1]);
  return parts.join(" ");
}

type Family = "volume" | "weight" | "exact";
function family(unit: string | null): Family {
  if (unit && unit in ML) return "volume";
  if (unit && unit in GRAMS) return "weight";
  return "exact"; // counted items and vague units (clove, can, pinch) only merge with themselves
}

function toBase(q: number, unit: string): number {
  return unit in ML ? q * ML[unit] : q * GRAMS[unit];
}
function fromBase(q: number, unit: string): number {
  return unit in ML ? q / ML[unit] : q / GRAMS[unit];
}

/** Can these two be added together, and if so what is the combined amount in `existing`'s unit? */
function combine(existing: GroceryItem, d: GroceryDraft): { quantity: number | null; unit: string | null } | null {
  if (normalizeName(existing.name) !== normalizeName(d.name)) return null;
  // an item with no amount ("salt") absorbs another with no amount
  if (existing.quantity === null && d.quantity === null) return { quantity: null, unit: existing.unit };
  if (existing.quantity === null || d.quantity === null) return null;
  const fe = family(existing.unit);
  const fd = family(d.unit);
  if (fe === "exact" || fd === "exact") {
    return existing.unit === d.unit ? { quantity: existing.quantity + d.quantity, unit: existing.unit } : null;
  }
  if (fe !== fd) return null;
  const sum = toBase(existing.quantity, existing.unit!) + toBase(d.quantity, d.unit!);
  return { quantity: fromBase(sum, existing.unit!), unit: existing.unit };
}

/**
 * Add new items to a list, merging into matching unchecked items. Returns the new list and
 * only the rows that were created or changed (so a database write can be small).
 */
export function addToList(
  list: GroceryItem[],
  drafts: GroceryDraft[],
  newId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): { list: GroceryItem[]; changed: GroceryItem[] } {
  const next = [...list];
  const changed = new Map<string, GroceryItem>();
  for (const d of drafts) {
    if (!d.name.trim()) continue;
    const idx = next.findIndex((it) => !it.checked && combine(it, d) !== null);
    if (idx >= 0) {
      const merged = combine(next[idx], d)!;
      const recipes = d.recipe && !next[idx].recipes.includes(d.recipe) ? [...next[idx].recipes, d.recipe] : next[idx].recipes;
      next[idx] = { ...next[idx], quantity: merged.quantity, unit: merged.unit, recipes };
      changed.set(next[idx].id, next[idx]);
    } else {
      const item: GroceryItem = {
        id: newId(),
        name: d.name.trim(),
        quantity: d.quantity,
        unit: d.unit,
        checked: false,
        recipes: d.recipe ? [d.recipe] : [],
        createdAt: now(),
      };
      next.unshift(item);
      changed.set(item.id, item);
    }
  }
  return { list: next, changed: [...changed.values()] };
}

/** Turn a recipe's ingredients, scaled by `factor`, into grocery drafts. */
export function draftsFromIngredients(ingredients: Ingredient[], factor: number, recipe: string): GroceryDraft[] {
  return ingredients.map((ing) => {
    const f = ing.scalable ? factor : 1;
    // for a range ("2-3 cloves") shop for the larger amount
    const base = ing.quantity === null ? null : (ing.quantityMax ?? ing.quantity) * f;
    return { name: ing.name, quantity: base, unit: ing.unit, recipe };
  });
}

/** How to show an item: amount (in the chosen unit system) and a name that agrees with it. */
export function displayGrocery(item: GroceryItem, system: UnitSystem): { amount: string; name: string } {
  const d = displayIngredient(
    { quantity: item.quantity, quantityMax: null, unit: item.unit, name: item.name, scalable: true },
    1,
    system,
  );
  const name = item.quantity !== null && !item.unit ? agreeWithAmount(item.name, item.quantity) : item.name;
  return { amount: d.amount, name };
}

/** Unchecked items first (newest first), then checked. */
export function sortItems(list: GroceryItem[]): { todo: GroceryItem[]; done: GroceryItem[] } {
  const byNew = (a: GroceryItem, b: GroceryItem) => b.createdAt.localeCompare(a.createdAt);
  return { todo: list.filter((i) => !i.checked).sort(byNew), done: list.filter((i) => i.checked).sort(byNew) };
}

/** Database row shape of public.grocery_items. */
export interface GroceryRow {
  id: string;
  text: string;
  name: string | null;
  quantity: number | string | null;
  unit: string | null;
  checked: boolean;
  recipes: string[] | null;
  created_at?: string;
}

export function groceryToRow(it: GroceryItem): GroceryRow & { created_at: string } {
  const { amount, name } = displayGrocery(it, "us");
  return {
    id: it.id,
    text: [amount, name].filter(Boolean).join(" "), // plain-text fallback, for the table view
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    checked: it.checked,
    recipes: it.recipes,
    created_at: it.createdAt,
  };
}

export function groceryFromRow(r: GroceryRow): GroceryItem {
  return {
    id: r.id,
    name: r.name ?? r.text,
    quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
    unit: r.unit,
    checked: !!r.checked,
    recipes: Array.isArray(r.recipes) ? r.recipes : [],
    createdAt: r.created_at ?? new Date(0).toISOString(),
  };
}
