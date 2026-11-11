import { describe, expect, it } from "vitest";
import type { Recipe } from "@/lib/recipe/types";
import { cookedFromRow, cookedSummary, cookedToRow, findCooked, historyFor, shortDate, sortRecipes, statsByRecipe, type CookedEntry } from "./cooked";

const r = (id: string, title: string): Recipe => ({ id, title, baseServings: 2, ingredients: [], steps: [], tags: [] });
const A = r("a", "Apple pie"), B = r("b", "Beef stew"), C = r("c", "Chili");
const e = (id: string, recipeId: string, day: string, servings: number | null = 2): CookedEntry => ({ id, recipeId, day, servings });
const entries = [e("1", "a", "2026-10-01"), e("2", "a", "2026-11-02"), e("3", "b", "2026-09-15"), e("4", "gone", "2026-11-01")];

describe("cooked stats", () => {
  it("counts and finds the last day per recipe, ignoring deleted recipes", () => {
    const s = statsByRecipe(entries, [A, B, C]);
    expect(s.get("a")).toEqual({ count: 2, last: "2026-11-02" });
    expect(s.get("b")).toEqual({ count: 1, last: "2026-09-15" });
    expect(s.has("c")).toBe(false);
    expect(s.has("gone")).toBe(false);
  });
  it("finds an entry for a day and lists history newest first", () => {
    expect(findCooked(entries, "a", "2026-10-01")?.id).toBe("1");
    expect(findCooked(entries, "a", "2026-10-02")).toBeUndefined();
    expect(historyFor(entries, "a").map((x) => x.day)).toEqual(["2026-11-02", "2026-10-01"]);
  });
});

describe("summary text", () => {
  it("formats dates, adding the year only when it differs", () => {
    expect(shortDate("2026-11-02", "2026-11-11")).toBe("Nov 2");
    expect(shortDate("2025-12-24", "2026-11-11")).toBe("Dec 24, 2025");
  });
  it("describes cooked and never-cooked recipes", () => {
    const s = statsByRecipe(entries, [A, B]);
    expect(cookedSummary(s.get("a"), "2026-11-11")).toBe("Cooked 2 times · last on Nov 2");
    expect(cookedSummary(s.get("b"), "2026-11-11")).toBe("Cooked 1 time · last on Sep 15");
    expect(cookedSummary(undefined, "2026-11-11")).toBe("Not cooked yet");
  });
});

describe("sorting", () => {
  const stats = statsByRecipe(entries, [A, B, C]);
  const titles = (l: Recipe[]) => l.map((x) => x.title);
  it("sorts by most cooked (ties by title)", () => {
    expect(titles(sortRecipes([C, B, A], "most", stats))).toEqual(["Apple pie", "Beef stew", "Chili"]);
  });
  it("puts never-cooked first, then the longest ago, for 'not cooked in a while'", () => {
    expect(titles(sortRecipes([A, B, C], "longest", stats))).toEqual(["Chili", "Beef stew", "Apple pie"]);
  });
  it("sorts A to Z and keeps 'newest' as the stored order without changing the input", () => {
    expect(titles(sortRecipes([C, A, B], "az", stats))).toEqual(["Apple pie", "Beef stew", "Chili"]);
    const input = [C, A, B];
    expect(titles(sortRecipes(input, "newest", stats))).toEqual(["Chili", "Apple pie", "Beef stew"]);
    expect(titles(input)).toEqual(["Chili", "Apple pie", "Beef stew"]);
  });
});

describe("rows", () => {
  it("round-trips, including an unknown people count", () => {
    expect(cookedFromRow({ ...cookedToRow(entries[0]), servings: "2", cooked_on: "2026-10-01T00:00:00" })).toEqual(entries[0]);
    expect(cookedFromRow(cookedToRow(e("9", "a", "2026-11-11", null))).servings).toBeNull();
  });
});
