import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { isoDurationToMinutes } from "./duration";
import { extractStructuredRecipe, pageTextForAi } from "./structured";
import { assertPublicUrl, isPrivateAddress } from "./safeFetch";
import { draftFromModelJson, parseRecipeWithClaude } from "./claude";
import { costUsd, type BudgetStore } from "./budget";
import { ImportError } from "./types";

const page = (ld: unknown, extra = "") => `<html><head><title>Site</title>
<meta property="og:image" content="https://img.example.com/og.jpg">
<script type="application/ld+json">${JSON.stringify(ld)}</script>${extra}</head><body><nav>Menu</nav><main>Hello</main></body></html>`;

const RECIPE = {
  "@type": "Recipe",
  name: "Pancakes &amp; Syrup",
  image: ["https://img.example.com/p.jpg"],
  recipeYield: ["4", "4 servings"],
  prepTime: "PT10M",
  cookTime: "PT1H5M",
  keywords: "breakfast, Easy",
  recipeCategory: "Brunch",
  recipeIngredient: ["1 1/2 cups flour", "2 eggs", "1 cup milk"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Mix the dry ingredients." },
    { "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "Cook on a hot pan." }] },
  ],
};

describe("duration", () => {
  it("parses ISO 8601", () => {
    expect(isoDurationToMinutes("PT1H30M")).toBe(90);
    expect(isoDurationToMinutes("PT45M")).toBe(45);
    expect(isoDurationToMinutes("P0DT20M")).toBe(20);
    expect(isoDurationToMinutes("nonsense")).toBeNull();
    expect(isoDurationToMinutes(undefined)).toBeNull();
  });
});

describe("structured import (schema.org Recipe)", () => {
  it("reads a recipe, including HowToSection steps and entities", () => {
    const r = extractStructuredRecipe(page(RECIPE), "https://example.com/p")!;
    expect(r.method).toBe("structured");
    expect(r.recipe.title).toBe("Pancakes & Syrup");
    expect(r.recipe.baseServings).toBe(4);
    expect(r.recipe.prepMinutes).toBe(10);
    expect(r.recipe.cookMinutes).toBe(65);
    expect(r.recipe.imageUrl).toBe("https://img.example.com/p.jpg");
    expect(r.recipe.ingredients[0]).toMatchObject({ quantity: 1.5, unit: "cup", name: "flour" });
    expect(r.recipe.steps.map((s) => s.text)).toEqual(["Mix the dry ingredients.", "Cook on a hot pan."]);
    expect(r.recipe.tags).toEqual(["breakfast", "easy", "brunch"]);
    expect(r.recipe.sourceUrl).toBe("https://example.com/p");
  });
  it("finds a recipe inside @graph and warns about missing servings and image", () => {
    const { recipeYield, image, ...rest } = RECIPE;
    void recipeYield; void image;
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebPage" }, rest] })}</script></head></html>`;
    const r = extractStructuredRecipe(html, "https://example.com")!;
    expect(r.recipe.baseServings).toBe(2);
    expect(r.warnings.join(" ")).toMatch(/servings/);
    expect(r.warnings.join(" ")).toMatch(/picture/);
  });
  it("splits a single instructions string into steps", () => {
    const r = extractStructuredRecipe(page({ ...RECIPE, recipeInstructions: "Mix.\nBake.\n\nServe." }), "u")!;
    expect(r.recipe.steps).toHaveLength(3);
  });
  it("returns null without usable recipe data", () => {
    expect(extractStructuredRecipe("<html><body>no recipe</body></html>", "u")).toBeNull();
    expect(extractStructuredRecipe(page({ "@type": "Recipe", name: "x" }), "u")).toBeNull();
    expect(extractStructuredRecipe(`<script type="application/ld+json">{bad json</script>`, "u")).toBeNull();
  });
  it("extracts readable page text without navigation and scripts", () => {
    const { text, image } = pageTextForAi(page(RECIPE));
    expect(text).toContain("Hello");
    expect(text).not.toContain("Menu");
    expect(image).toBe("https://img.example.com/og.jpg");
  });
});

describe("URL safety", () => {
  it("flags private and special addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it("rejects bad or internal URLs before fetching", async () => {
    for (const u of ["notaurl", "ftp://example.com", "http://localhost/x", "http://127.0.0.1/", "http://169.254.169.254/latest", "http://user:pw@example.com", "http://example.com:8080/", "http://[::1]/"])
      await expect(assertPublicUrl(u), u).rejects.toBeInstanceOf(ImportError);
  });
});

describe("AI import", () => {
  const good = {
    is_recipe: true, title: "Toast", servings: 2, prep_minutes: 1, cook_minutes: 3,
    ingredients: ["2 slices bread", "1 tbsp butter"], steps: ["Toast the bread.", "Butter it."], tags: ["Breakfast"], notes: "",
  };
  const fake = (json: unknown, over: Record<string, unknown> = {}) =>
    ({
      beta: { messages: { create: async () => ({ stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 500 }, content: [{ type: "text", text: JSON.stringify(json) }], ...over }) } },
    }) as unknown as Anthropic;
  const mem = (start = 0): BudgetStore & { total: () => number } => {
    let t = start;
    return { spent: async () => t, add: async (_u, _m, usd) => { t += usd; }, total: () => t };
  };

  it("turns model JSON into a draft", () => {
    const r = draftFromModelJson(good, { sourceUrl: "https://x.com" });
    expect(r.recipe.ingredients[0]).toMatchObject({ quantity: 2, unit: "slice", name: "bread" });
    expect(r.recipe.tags).toEqual(["breakfast"]);
    expect(r.warnings).toEqual([]);
  });
  it("rejects non-recipes", () => {
    expect(() => draftFromModelJson({ ...good, is_recipe: false }, {})).toThrow(ImportError);
    expect(() => draftFromModelJson({ ...good, ingredients: [] }, {})).toThrow(ImportError);
    expect(() => draftFromModelJson("junk", {})).toThrow(ImportError);
  });
  it("records spend and reports budget", async () => {
    const store = mem();
    const r = await parseRecipeWithClaude("toast recipe", { userId: "u", client: fake(good), store });
    expect(r.recipe.title).toBe("Toast");
    expect(store.total()).toBeCloseTo(costUsd("claude-opus-5-5", { input_tokens: 1000, output_tokens: 500 }));
    expect(r.budget.capUsd).toBe(10);
  });
  it("blocks AI use once the monthly cap is reached", async () => {
    await expect(parseRecipeWithClaude("x", { userId: "u", client: fake(good), store: mem(10) })).rejects.toMatchObject({ code: "ai_budget" });
  });
  it("warns near the limit", async () => {
    const r = await parseRecipeWithClaude("x", { userId: "u", client: fake(good), store: mem(8.5) });
    expect(r.budget.nearLimit).toBe(true);
  });
  it("handles refusals, truncation and bad JSON", async () => {
    await expect(parseRecipeWithClaude("x", { userId: "u", client: fake(good, { stop_reason: "refusal" }), store: mem() })).rejects.toMatchObject({ code: "ai_declined" });
    await expect(parseRecipeWithClaude("x", { userId: "u", client: fake(good, { stop_reason: "max_tokens" }), store: mem() })).rejects.toMatchObject({ code: "too_long" });
    await expect(parseRecipeWithClaude("x", { userId: "u", client: fake("not json"), store: mem() })).rejects.toBeInstanceOf(ImportError);
  });
  it("rejects empty and oversized input without calling the API", async () => {
    await expect(parseRecipeWithClaude("  ", { userId: "u", client: fake(good) })).rejects.toMatchObject({ code: "no_recipe" });
    await expect(parseRecipeWithClaude("a".repeat(30_001), { userId: "u", client: fake(good) })).rejects.toMatchObject({ code: "too_long" });
  });
});
