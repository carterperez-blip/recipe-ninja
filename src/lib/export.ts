import type { CookedEntry } from "@/lib/cooked";
import type { PlanEntry } from "@/lib/plan";
import type { GroceryItem } from "@/lib/recipe/grocery";
import { creditLabel } from "@/lib/recipe/credit";
import { rawIngredientText } from "@/lib/recipe/scale";
import type { Recipe } from "@/lib/recipe/types";

export const BACKUP_FORMAT = "recipe-ninja-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  counts: { recipes: number; groceryItems: number; plannedMeals: number; cookedEntries: number };
  recipes: Recipe[];
  groceryList: GroceryItem[];
  mealPlan: PlanEntry[];
  cookedHistory: CookedEntry[];
}

/** Everything in the library as one JSON-friendly object. Contains no passwords, keys or account details. */
export function buildBackup(data: {
  recipes: Recipe[];
  grocery: GroceryItem[];
  plan: PlanEntry[];
  cooked: CookedEntry[];
  exportedAt: string;
}): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: data.exportedAt,
    counts: {
      recipes: data.recipes.length,
      groceryItems: data.grocery.length,
      plannedMeals: data.plan.length,
      cookedEntries: data.cooked.length,
    },
    recipes: data.recipes,
    groceryList: data.grocery,
    mealPlan: data.plan,
    cookedHistory: data.cooked,
  };
}

export const backupFileName = (today: string, ext: "json" | "md") => `recipe-ninja-${ext === "json" ? "backup" : "recipes"}-${today}.${ext}`;

const minutes = (m?: number | null) => (m ? `${m} min` : null);

/** The recipes as a readable Markdown document (ingredients as written, steps numbered), for printing or sharing. */
export function recipesToMarkdown(recipes: Recipe[]): string {
  const parts = recipes.map((r) => {
    const meta = [
      `Serves ${r.baseServings}`,
      minutes(r.prepMinutes) && `Prep ${minutes(r.prepMinutes)}`,
      minutes(r.cookMinutes) && `Cook ${minutes(r.cookMinutes)}`,
      r.tags.length ? `Tags: ${r.tags.join(", ")}` : null,
      r.rating ? `Rating: ${r.rating}/5` : null,
    ].filter(Boolean);
    const lines = [`# ${r.title}`, "", meta.join(" · ")];
    if (r.sourceUrl) lines.push("", `Source: ${r.sourceUrl}`);
    if (r.imageCredit && r.imageUrl) lines.push("", creditLabel(r.imageCredit));
    lines.push("", "## Ingredients", "", ...r.ingredients.map((i) => `- ${rawIngredientText(i)}`));
    lines.push("", "## Instructions", "", ...r.steps.map((s, i) => `${i + 1}. ${s.text}`));
    if (r.notes?.trim()) lines.push("", "## Notes", "", r.notes.trim());
    return lines.join("\n");
  });
  return `${parts.join("\n\n---\n\n")}\n`;
}
