import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "@/lib/recipe/parse";
import { addToList } from "@/lib/recipe/grocery";
import type { Recipe } from "@/lib/recipe/types";
import {
  addDaysISO, dayLabel, entriesForDay, groceryDraftsForDays, isISODate, planFromRow, planToRow,
  relativeDay, startOfWeekISO, todayISO, weekDays, weekLabel, type PlanEntry,
} from "./plan";

const recipe = (id: string, title: string, base: number, lines: string[]): Recipe => ({
  id, title, baseServings: base, ingredients: lines.map(parseIngredientLine), steps: [], tags: [],
});

describe("dates", () => {
  it("formats today on the local clock", () => {
    expect(todayISO(new Date(2026, 10, 9, 23, 59))).toBe("2026-11-09");
    expect(todayISO(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
  });
  it("adds days across month and year ends and leap days", () => {
    expect(addDaysISO("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds the week start (Monday by default)", () => {
    expect(startOfWeekISO("2026-11-11")).toBe("2026-11-09"); // Wed -> Mon
    expect(startOfWeekISO("2026-11-09")).toBe("2026-11-09"); // Mon
    expect(startOfWeekISO("2026-11-15")).toBe("2026-11-09"); // Sun belongs to the week before
    expect(startOfWeekISO("2026-11-15", 0)).toBe("2026-11-15"); // Sunday-start weeks
    expect(startOfWeekISO("2026-11-11", 0)).toBe("2026-11-08");
  });
  it("lists the seven days and labels them", () => {
    const days = weekDays("2026-11-09");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-11-09");
    expect(days[6]).toBe("2026-11-15");
    expect(dayLabel("2026-11-09")).toBe("Mon, Nov 9");
    expect(weekLabel("2026-11-09")).toBe("Nov 9 – Nov 15");
    expect(weekLabel("2026-12-28")).toBe("Dec 28 – Jan 3");
  });
  it("names days relative to today", () => {
    expect(relativeDay("2026-11-11", "2026-11-11")).toBe("Today");
    expect(relativeDay("2026-11-12", "2026-11-11")).toBe("Tomorrow");
    expect(relativeDay("2026-11-14", "2026-11-11")).toBe("Sat, Nov 14");
  });
  it("validates ISO dates", () => {
    expect(isISODate("2026-11-11")).toBe(true);
    for (const bad of ["2026-13-01", "11/11/2026", "", "2026-11-1", "2026-02-30x"]) expect(isISODate(bad), bad).toBe(false);
  });
});

describe("planning", () => {
  const chicken = recipe("c", "Chicken", 4, ["2 cups rice", "1 lemon"]);
  const pasta = recipe("p", "Pasta", 2, ["200 g spaghetti", "1 lemon"]);
  const entries: PlanEntry[] = [
    { id: "1", recipeId: "c", day: "2026-11-10", servings: 2 },
    { id: "2", recipeId: "p", day: "2026-11-11", servings: 4 },
    { id: "3", recipeId: "p", day: "2026-11-20", servings: 2 }, // outside the week
    { id: "4", recipeId: "gone", day: "2026-11-10", servings: 2 }, // recipe deleted
  ];
  it("lists a day's meals and ignores deleted recipes", () => {
    expect(entriesForDay(entries, "2026-11-10", [chicken, pasta]).map((e) => e.id)).toEqual(["1"]);
  });
  it("builds grocery drafts for a week, scaled per meal, and they combine", () => {
    const drafts = groceryDraftsForDays(entries, weekDays("2026-11-09"), [chicken, pasta]);
    const { list } = addToList([], drafts, (() => { let n = 0; return () => `g${++n}`; })());
    const text = list.map((i) => `${i.quantity}${i.unit ?? ""} ${i.name}`).sort();
    // chicken for 2 of 4 -> 1 cup rice, 0.5 lemon; pasta for 4 of 2 -> 400 g spaghetti, 2 lemon
    expect(text).toEqual(["1cup rice", "2.5 lemon", "400g spaghetti"]);
    expect(list.find((i) => i.name === "lemon")!.recipes).toEqual(["Chicken", "Pasta"]);
  });
  it("round-trips a database row", () => {
    expect(planFromRow({ ...planToRow(entries[0]), servings: "2", day: "2026-11-10T00:00:00" })).toEqual(entries[0]);
  });
});
