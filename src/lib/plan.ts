import { DEFAULT_SERVINGS, type Recipe } from "@/lib/recipe/types";
import { draftsFromIngredients, type GroceryDraft } from "@/lib/recipe/grocery";

/** One planned meal: a recipe on a day, for some number of people. */
export interface PlanEntry {
  id: string;
  recipeId: string;
  /** Calendar day as YYYY-MM-DD (no time zone, so it never shifts). */
  day: string;
  servings: number;
}

export const DEFAULT_PLAN_SERVINGS = DEFAULT_SERVINGS;
/** 0 = Sunday, 1 = Monday. */
export const WEEK_STARTS_ON = 1;

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date on the user's own clock. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDaysISO(iso: string, days: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** First day of the week containing `iso`. */
export function startOfWeekISO(iso: string, weekStartsOn: number = WEEK_STARTS_ON): string {
  const dow = utc(iso).getUTCDay();
  return addDaysISO(iso, -((dow - weekStartsOn + 7) % 7));
}

export function weekDays(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(startISO, i));
}

/** "Mon, Nov 10". */
export function dayLabel(iso: string): string {
  return utc(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Nov 10 – Nov 16". */
export function weekLabel(startISO: string): string {
  const f = (iso: string) => utc(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(startISO)} – ${f(addDaysISO(startISO, 6))}`;
}

/** Friendly name for a day relative to today: Today, Tomorrow, or the label. */
export function relativeDay(iso: string, today: string = todayISO()): string {
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, 1)) return "Tomorrow";
  return dayLabel(iso);
}

/** Entries for one day, ignoring any whose recipe no longer exists. */
export function entriesForDay(entries: PlanEntry[], day: string, recipes: Recipe[]): PlanEntry[] {
  const ids = new Set(recipes.map((r) => r.id));
  return entries.filter((e) => e.day === day && ids.has(e.recipeId));
}

/** Grocery drafts for every meal in the given days, each scaled to its own people count. */
export function groceryDraftsForDays(entries: PlanEntry[], days: string[], recipes: Recipe[]): GroceryDraft[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const inRange = new Set(days);
  return entries
    .filter((e) => inRange.has(e.day))
    .sort((a, b) => a.day.localeCompare(b.day))
    .flatMap((e) => {
      const r = byId.get(e.recipeId);
      return r ? draftsFromIngredients(r.ingredients, e.servings / r.baseServings, r.title) : [];
    });
}

/** Database row shape of public.meal_plan. */
export interface PlanRow {
  id: string;
  recipe_id: string;
  day: string;
  servings: number | string;
}

export const planToRow = (e: PlanEntry): PlanRow => ({ id: e.id, recipe_id: e.recipeId, day: e.day, servings: e.servings });
export const planFromRow = (r: PlanRow): PlanEntry => ({
  id: r.id,
  recipeId: r.recipe_id,
  day: String(r.day).slice(0, 10),
  servings: Number(r.servings),
});
