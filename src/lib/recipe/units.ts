import type { UnitSystem } from "./types";

/** Canonical unit key -> accepted spellings (lowercase). */
const ALIASES: Record<string, string[]> = {
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons"],
  tbsp: ["tbsp", "tbsps", "tbs", "tablespoon", "tablespoons"],
  cup: ["cup", "cups"],
  floz: ["fl oz", "floz", "fluid ounce", "fluid ounces"],
  pint: ["pint", "pints", "pt"],
  quart: ["quart", "quarts", "qt"],
  gallon: ["gallon", "gallons", "gal"],
  oz: ["oz", "ounce", "ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  g: ["g", "gram", "grams"],
  kg: ["kg", "kilogram", "kilograms"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  // counted / vague units: recognised but never converted
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  slice: ["slice", "slices"],
  sprig: ["sprig", "sprigs"],
  bunch: ["bunch", "bunches"],
  package: ["package", "packages", "pkg"],
  stick: ["stick", "sticks"],
};

const LOOKUP = new Map<string, string>();
for (const [key, list] of Object.entries(ALIASES)) for (const a of list) LOOKUP.set(a, key);

export function canonicalUnit(word: string): string | null {
  return LOOKUP.get(word.toLowerCase().replace(/\.$/, "")) ?? null;
}

/** Millilitres per volume unit (US customary). */
const ML: Record<string, number> = {
  tsp: 4.92892, tbsp: 14.7868, floz: 29.5735, cup: 236.588,
  pint: 473.176, quart: 946.353, gallon: 3785.41, ml: 1, l: 1000,
};
/** Grams per weight unit. */
const GRAMS: Record<string, number> = { oz: 28.3495, lb: 453.592, g: 1, kg: 1000 };

/** Approximate grams per US cup for common ingredients (keys matched as substrings). */
const DENSITY_G_PER_CUP: [string, number][] = [
  ["all-purpose flour", 125], ["bread flour", 127], ["whole wheat flour", 120], ["flour", 125],
  ["brown sugar", 213], ["powdered sugar", 120], ["confectioners", 120], ["sugar", 200],
  ["butter", 227], ["honey", 340], ["rice", 185], ["rolled oats", 90], ["oats", 90],
  ["cocoa", 85], ["cornstarch", 128], ["parmesan", 100], ["cheese", 113], ["salt", 288],
  ["water", 237], ["milk", 245], ["cream", 240], ["olive oil", 216], ["oil", 218],
];

export function isVolume(u: string | null): boolean {
  return !!u && u in ML;
}
export function isWeight(u: string | null): boolean {
  return !!u && u in GRAMS;
}

function densityFor(name: string): number | null {
  const n = name.toLowerCase();
  for (const [k, v] of DENSITY_G_PER_CUP) if (n.includes(k)) return v;
  return null;
}

export interface Amount {
  quantity: number;
  quantityMax?: number | null;
  unit: string | null;
}

function roundMl(ml: number): number {
  if (ml < 15) return Math.round(ml * 2) / 2;
  if (ml < 100) return Math.round(ml / 5) * 5;
  return Math.round(ml / 10) * 10;
}
function roundG(g: number): number {
  if (g < 20) return Math.max(1, Math.round(g));
  return Math.round(g / 5) * 5;
}

function metricOne(q: number, unit: string, name: string): { q: number; unit: string } {
  if (isWeight(unit)) {
    const g = roundG(q * GRAMS[unit]);
    return g >= 1000 ? { q: Math.round(g / 10) / 100, unit: "kg" } : { q: g, unit: "g" };
  }
  // volume: use grams when we know the density of dry/solid ingredients
  const dens = unit === "tsp" || unit === "tbsp" || unit === "cup" ? densityFor(name) : null;
  const liquid = /\b(water|milk|cream|oil|broth|stock|juice|wine|vinegar|sauce)\b/i.test(name);
  if (dens && !liquid) {
    const g = roundG((q * ML[unit] / ML.cup) * dens);
    return g >= 1000 ? { q: Math.round(g / 10) / 100, unit: "kg" } : { q: g, unit: "g" };
  }
  const ml = roundMl(q * ML[unit]);
  return ml >= 1000 ? { q: Math.round(ml / 10) / 100, unit: "l" } : { q: ml, unit: "ml" };
}

export function toMetric(a: Amount, name: string): Amount {
  if (!a.unit || (!isVolume(a.unit) && !isWeight(a.unit)) || a.unit === "g" || a.unit === "kg" || a.unit === "ml" || a.unit === "l") {
    return a;
  }
  const lo = metricOne(a.quantity, a.unit, name);
  const hi = a.quantityMax != null ? metricOne(a.quantityMax, a.unit, name) : null;
  return { quantity: lo.q, quantityMax: hi ? hi.q : null, unit: lo.unit };
}

function usOne(q: number, unit: string): { q: number; unit: string } {
  if (unit === "g" || unit === "kg") {
    const g = unit === "kg" ? q * 1000 : q;
    return g >= 454 ? { q: g / GRAMS.lb, unit: "lb" } : { q: g / GRAMS.oz, unit: "oz" };
  }
  const ml = unit === "l" ? q * 1000 : q;
  if (ml >= 59) return { q: ml / ML.cup, unit: "cup" };
  if (ml >= 15) return { q: ml / ML.tbsp, unit: "tbsp" };
  return { q: ml / ML.tsp, unit: "tsp" };
}

export function toUS(a: Amount): Amount {
  if (a.unit !== "g" && a.unit !== "kg" && a.unit !== "ml" && a.unit !== "l") return a;
  const lo = usOne(a.quantity, a.unit);
  const hi = a.quantityMax != null ? usOne(a.quantityMax, a.unit) : null;
  return { quantity: lo.q, quantityMax: hi ? hi.q : null, unit: lo.unit };
}

/** Roll US kitchen units up or down so amounts stay readable (48 tsp -> 1 cup). */
export function smoothUS(a: Amount): Amount {
  let { quantity, quantityMax, unit } = a;
  const factor = (from: string, to: string) => ML[from] / ML[to];
  const step = (f: number) => {
    quantity *= f;
    if (quantityMax != null) quantityMax *= f;
  };
  if (unit === "tsp" && quantity >= 3) { step(1 / 3); unit = "tbsp"; }
  if (unit === "tbsp" && quantity >= 4) { step(factor("tbsp", "cup")); unit = "cup"; }
  else if (unit === "tbsp" && quantity < 1) { step(3); unit = "tsp"; }
  if (unit === "cup" && quantity < 0.125) { step(16); unit = "tbsp"; }
  return { quantity, quantityMax, unit };
}

export const UNIT_LABEL: Record<string, [string, string]> = {
  tsp: ["tsp", "tsp"], tbsp: ["tbsp", "tbsp"], cup: ["cup", "cups"], floz: ["fl oz", "fl oz"],
  pint: ["pint", "pints"], quart: ["quart", "quarts"], gallon: ["gallon", "gallons"],
  oz: ["oz", "oz"], lb: ["lb", "lb"], g: ["g", "g"], kg: ["kg", "kg"], ml: ["ml", "ml"], l: ["l", "l"],
  clove: ["clove", "cloves"], can: ["can", "cans"], pinch: ["pinch", "pinches"], dash: ["dash", "dashes"],
  slice: ["slice", "slices"], sprig: ["sprig", "sprigs"], bunch: ["bunch", "bunches"],
  package: ["package", "packages"], stick: ["stick", "sticks"],
};

export function unitLabel(unit: string, quantity: number): string {
  const l = UNIT_LABEL[unit] ?? [unit, unit];
  return quantity > 1 ? l[1] : l[0];
}

/** Convert temperatures written like "350°F" or "180 °C" inside step text. */
export function convertTemperatures(text: string, system: UnitSystem): string {
  return text.replace(/(\d{2,3})\s?°\s?([FC])\b/g, (m, n: string, scale: string) => {
    const v = Number(n);
    if (system === "metric" && scale === "F") return `${Math.round(((v - 32) * 5) / 9 / 10) * 10}°C`;
    if (system === "us" && scale === "C") return `${Math.round(((v * 9) / 5 + 32) / 25) * 25}°F`;
    return m;
  });
}
