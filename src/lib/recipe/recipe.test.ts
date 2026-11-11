import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "./parse";
import { displayIngredient, scaleFactor } from "./scale";
import { formatQuantity, parseLeadingQuantity } from "./quantity";
import { convertTemperatures } from "./units";

const text = (line: string, people: number, base: number, system: "us" | "metric" = "us") =>
  displayIngredient(parseIngredientLine(line), scaleFactor(people, base), system).text;

describe("quantity", () => {
  it("parses fractions, mixed numbers, unicode and ranges", () => {
    expect(parseLeadingQuantity("1/2 cup")?.min).toBe(0.5);
    expect(parseLeadingQuantity("1 1/2 cups")?.min).toBe(1.5);
    expect(parseLeadingQuantity("1½ cups")?.min).toBe(1.5);
    expect(parseLeadingQuantity("2-3 cloves")).toMatchObject({ min: 2, max: 3 });
    expect(parseLeadingQuantity("salt")).toBeNull();
  });
  it("formats friendly fractions", () => {
    expect(formatQuantity(1.5)).toBe("1½");
    expect(formatQuantity(0.33)).toBe("⅓");
    expect(formatQuantity(0.25)).toBe("¼");
    expect(formatQuantity(2)).toBe("2");
  });
});

describe("ingredient parsing", () => {
  it("splits quantity, unit, name and note", () => {
    expect(parseIngredientLine("1 1/2 cups all-purpose flour, sifted")).toMatchObject({
      quantity: 1.5, unit: "cup", name: "all-purpose flour", note: "sifted", scalable: true,
    });
  });
  it("marks to-taste and pinch as not scalable", () => {
    expect(parseIngredientLine("salt, to taste").scalable).toBe(false);
    expect(parseIngredientLine("1 pinch saffron").scalable).toBe(false);
  });
});

describe("scaler (acceptance from the PRD)", () => {
  const rice = "2 cups rice";
  const salt = "1 tsp salt";
  it("recipe for 4 shown at 2 people", () => {
    expect(text(rice, 2, 4)).toBe("1 cup rice");
    expect(text(salt, 2, 4)).toBe("½ tsp salt");
  });
  it("at 6 people", () => {
    expect(text(rice, 6, 4)).toBe("3 cups rice");
    expect(text(salt, 6, 4)).toBe("1½ tsp salt");
  });
  it("at 1 person", () => {
    expect(text(rice, 1, 4)).toBe("½ cup rice");
    expect(text(salt, 1, 4)).toBe("¼ tsp salt");
  });
  it("rolls units up", () => {
    expect(text("3 tsp sugar", 4, 2).startsWith("2 tbsp")).toBe(true);
  });
  it("does not scale to-taste items", () => {
    expect(text("salt, to taste", 8, 2)).toBe("salt, to taste");
  });
  it("keeps counted nouns agreeing with the amount", () => {
    expect(text("2 eggs", 1, 2)).toBe("1 egg");
    expect(text("1 onion, diced", 4, 2)).toBe("2 onions, diced");
    expect(text("2 tomatoes", 1, 2)).toBe("1 tomato");
    expect(text("1 potato", 4, 2)).toBe("2 potatoes");
    expect(text("2 cups flour", 1, 2)).toBe("1 cup flour");
    expect(text("2 eggs", 2, 2)).toBe("2 eggs"); // unscaled text is left as written
  });
  it("flags counted items that scale to a fraction", () => {
    const d = displayIngredient(parseIngredientLine("1 egg"), 1.5, "us");
    expect(d.text).toBe("1½ eggs");
    expect(d.roundHint).toBe(true);
  });
});

describe("unit toggle", () => {
  it("converts cups of flour to grams", () => {
    expect(text("1 cup all-purpose flour", 2, 2, "metric")).toBe("125 g all-purpose flour");
  });
  it("converts liquids to ml", () => {
    expect(text("1 cup milk", 2, 2, "metric")).toBe("240 ml milk");
  });
  it("converts metric recipes to US", () => {
    expect(text("480 ml water", 2, 2, "us")).toBe("2 cups water");
  });
  it("converts oven temperatures", () => {
    expect(convertTemperatures("Bake at 350°F", "metric")).toBe("Bake at 180°C");
    expect(convertTemperatures("Bake at 180°C", "us")).toBe("Bake at 350°F");
  });
});
