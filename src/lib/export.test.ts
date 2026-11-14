import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "@/lib/recipe/parse";
import type { Recipe } from "@/lib/recipe/types";
import { BACKUP_FORMAT, backupFileName, buildBackup, recipesToMarkdown } from "./export";

const recipe: Recipe = {
  id: "r1", title: "Lemon Chicken", baseServings: 4, prepMinutes: 10, cookMinutes: 25, sourceUrl: "https://example.com/lc",
  imageUrl: "https://img.example.com/lc.jpg", imageCredit: { name: "Xiaoyin Li", source: "other", license: "CC BY" },
  ingredients: ["1 1/2 lb chicken breast", "3 cloves garlic, minced", "salt, to taste"].map(parseIngredientLine),
  steps: [{ text: "Season." }, { text: "Sear for 5 minutes." }], tags: ["dinner", "quick"], notes: "Great with rice.", rating: 4, favorite: true,
};

describe("backup", () => {
  const backup = buildBackup({
    recipes: [recipe],
    grocery: [{ id: "g1", name: "milk", quantity: 1, unit: "cup", checked: false, recipes: ["Lemon Chicken"], createdAt: "2026-11-11T00:00:00.000Z" }],
    plan: [{ id: "p1", recipeId: "r1", day: "2026-11-12", servings: 3 }],
    cooked: [{ id: "c1", recipeId: "r1", day: "2026-11-02", servings: 2 }, { id: "c2", recipeId: "r1", day: "2026-11-09", servings: null }],
    exportedAt: "2026-11-11T10:00:00.000Z",
  });
  it("has a format marker, version, date and counts", () => {
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe("2026-11-11T10:00:00.000Z");
    expect(backup.counts).toEqual({ recipes: 1, groceryItems: 1, plannedMeals: 1, cookedEntries: 2 });
  });
  it("survives a JSON round trip with nothing lost", () => {
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
    expect(JSON.parse(JSON.stringify(backup)).recipes[0].ingredients[0]).toMatchObject({ quantity: 1.5, unit: "lb", name: "chicken breast" });
  });
  it("holds no account or key fields", () => {
    const text = JSON.stringify(backup).toLowerCase();
    for (const word of ["email", "token", "password", "secret", "api_key", "apikey", "user_id"]) expect(text).not.toContain(word);
  });
  it("names files by date", () => {
    expect(backupFileName("2026-11-11", "json")).toBe("recipe-ninja-backup-2026-11-11.json");
    expect(backupFileName("2026-11-11", "md")).toBe("recipe-ninja-recipes-2026-11-11.md");
  });
  it("handles an empty library", () => {
    const empty = buildBackup({ recipes: [], grocery: [], plan: [], cooked: [], exportedAt: "x" });
    expect(empty.counts.recipes).toBe(0);
    expect(recipesToMarkdown([])).toBe("\n");
  });
});

describe("markdown export", () => {
  const md = recipesToMarkdown([recipe, { ...recipe, id: "r2", title: "Plain Toast", sourceUrl: null, imageCredit: null, notes: "", tags: [], rating: null, prepMinutes: null, cookMinutes: null, ingredients: [parseIngredientLine("2 slices bread")], steps: [{ text: "Toast." }] }]);
  it("writes a readable recipe", () => {
    expect(md).toContain("# Lemon Chicken");
    expect(md).toContain("Serves 4 · Prep 10 min · Cook 25 min · Tags: dinner, quick · Rating: 4/5");
    expect(md).toContain("Source: https://example.com/lc");
    expect(md).toContain("Photo by Xiaoyin Li (CC BY)");
    expect(md).toContain("- 1½ lb chicken breast");
    expect(md).toContain("- 3 cloves garlic, minced");
    expect(md).toContain("- salt, to taste");
    expect(md).toContain("1. Season.\n2. Sear for 5 minutes.");
    expect(md).toContain("## Notes\n\nGreat with rice.");
  });
  it("separates recipes and leaves out empty parts", () => {
    expect(md).toContain("\n\n---\n\n# Plain Toast");
    const toast = md.split("---")[1];
    expect(toast).toContain("Serves 4");
    expect(toast).not.toContain("Source:");
    expect(toast).not.toContain("## Notes");
    expect(toast).not.toContain("Photo by");
    expect(toast).not.toContain("Tags:");
  });
});
