import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "./parse";
import { addToList, displayGrocery, draftsFromIngredients, groceryFromRow, groceryToRow, normalizeName, sortItems, type GroceryItem } from "./grocery";

let n = 0;
const id = () => `id${++n}`;
const now = () => "2026-11-11T00:00:00.000Z";
const add = (list: GroceryItem[], lines: string[], recipe = "R", factor = 1) =>
  addToList(list, draftsFromIngredients(lines.map(parseIngredientLine), factor, recipe), id, now);
const show = (list: GroceryItem[], sys: "us" | "metric" = "us") =>
  list.map((i) => { const d = displayGrocery(i, sys); return [d.amount, d.name].filter(Boolean).join(" "); }).sort();

describe("grocery merging", () => {
  it("adds a recipe's ingredients scaled for the people count", () => {
    const { list } = add([], ["2 cups rice", "1 tsp salt"], "Rice", 0.5);
    expect(show(list)).toEqual(["1 cup rice", "½ tsp salt"]);
  });
  it("combines the same unit", () => {
    const a = add([], ["2 cups flour"], "A").list;
    const b = add(a, ["1 cup flour"], "B").list;
    expect(show(b)).toEqual(["3 cups flour"]);
    expect(b[0].recipes).toEqual(["A", "B"]);
  });
  it("combines different volume units into the first item's unit", () => {
    const a = add([], ["1 cup milk"]).list;
    const b = add(a, ["4 tbsp milk"]).list;
    expect(show(b)).toEqual(["1¼ cups milk"]);
  });
  it("combines weights across units", () => {
    const a = add([], ["1 lb butter"]).list;
    const b = add(a, ["8 oz butter"]).list;
    expect(show(b)).toEqual(["1½ lb butter"]);
  });
  it("combines counted items and keeps names agreeing with the amount", () => {
    const a = add([], ["2 eggs"]).list;
    const b = add(a, ["1 egg"]).list;
    expect(show(b)).toEqual(["3 eggs"]);
    expect(show(add([], ["1 onion"]).list)).toEqual(["1 onion"]);
    expect(show(add(add([], ["1 onion"]).list, ["2 onions"]).list)).toEqual(["3 onions"]);
  });
  it("keeps volume and weight of the same food on separate lines", () => {
    const b = add(add([], ["1 cup flour"]).list, ["200 g flour"]).list;
    expect(b).toHaveLength(2);
  });
  it("merges items with no amount into one", () => {
    const b = add(add([], ["salt, to taste"]).list, ["salt, to taste"]).list;
    expect(show(b)).toEqual(["salt"]);
  });
  it("keeps an amount and a no-amount item of the same name separate", () => {
    expect(add(add([], ["salt, to taste"]).list, ["1 tsp salt"]).list).toHaveLength(2);
  });
  it("does not merge into a checked item", () => {
    const a = add([], ["1 cup milk"]).list;
    const checked = a.map((i) => ({ ...i, checked: true }));
    const b = add(checked, ["1 cup milk"]).list;
    expect(b).toHaveLength(2);
    expect(b.filter((i) => !i.checked)).toHaveLength(1);
  });
  it("vague units only merge with the same unit", () => {
    expect(show(add(add([], ["2 cloves garlic"]).list, ["1 clove garlic"]).list)).toEqual(["3 cloves garlic"]);
    expect(add(add([], ["2 cloves garlic"]).list, ["1 tbsp garlic"]).list).toHaveLength(2);
  });
  it("shops for the larger end of a range", () => {
    expect(show(add([], ["2-3 cloves garlic"]).list)).toEqual(["3 cloves garlic"]);
  });
  it("reports only the rows that changed", () => {
    const a = add([], ["1 cup milk", "2 eggs"]).list;
    const r = add(a, ["1 cup milk", "1 lemon"]);
    expect(r.changed.map((c) => c.name).sort()).toEqual(["lemon", "milk"]);
  });
  it("ignores blank names", () => {
    expect(addToList([], [{ name: "  ", quantity: 1, unit: null }], id, now).list).toEqual([]);
  });
  it("matches names loosely (plurals, case)", () => {
    expect(normalizeName("Tomatoes")).toBe(normalizeName("tomato"));
    expect(show(add(add([], ["2 Tomatoes"]).list, ["1 tomato"]).list)).toEqual(["3 Tomatoes"]); // keeps the first spelling
  });
  it("shows metric when asked", () => {
    expect(show(add([], ["1 cup all-purpose flour"]).list, "metric")).toEqual(["125 g all-purpose flour"]);
  });
  it("sorts unchecked before checked", () => {
    const list = add([], ["1 cup milk", "2 eggs"]).list.map((i, k) => ({ ...i, checked: k === 0, createdAt: `2026-11-1${k}` }));
    const { todo, done } = sortItems(list);
    expect(todo).toHaveLength(1);
    expect(done).toHaveLength(1);
  });
  it("round-trips through a database row", () => {
    const item = add([], ["1 1/2 cups flour"], "Cake").list[0];
    const row = groceryToRow(item);
    expect(row.text).toBe("1½ cups flour");
    expect(groceryFromRow({ ...row, quantity: String(row.quantity) })).toEqual(item);
  });
});

describe("clean unit roll-ups", () => {
  it("does not turn 5 tbsp into a rounded fraction of a cup", () => {
    expect(show(add(add([], ["1 tbsp olive oil"]).list, ["4 tbsp olive oil"]).list)).toEqual(["5 tbsp olive oil"]);
    expect(show(add(add([], ["2 tbsp olive oil"]).list, ["2 tbsp olive oil"]).list)).toEqual(["¼ cup olive oil"]);
    expect(show(add([], ["7 tbsp butter"]).list)).toEqual(["7 tbsp butter"]);
    expect(show(add([], ["3½ tsp sugar"]).list)).toEqual(["3½ tsp sugar"]);
    expect(show(add([], ["4 tsp sugar"]).list)).toEqual(["1⅓ tbsp sugar"]);
  });
});
