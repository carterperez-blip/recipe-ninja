import type { Ingredient, UnitSystem } from "./types";
import { formatRange, formatQuantity } from "./quantity";
import { smoothUS, toMetric, toUS, unitLabel, type Amount } from "./units";

export function scaleFactor(peopleWanted: number, baseServings: number): number {
  if (!(peopleWanted > 0) || !(baseServings > 0)) return 1;
  return peopleWanted / baseServings;
}

export interface DisplayIngredient {
  /** Text for the amount, e.g. "1½ cups"; empty when there is no amount. */
  amount: string;
  name: string;
  note?: string;
  /** True for counted items scaled to a fraction, e.g. "1½ eggs". */
  roundHint: boolean;
  text: string;
}

export function displayIngredient(
  ing: Ingredient,
  factor: number,
  system: UnitSystem,
): DisplayIngredient {
  if (ing.quantity === null) {
    return { amount: "", name: ing.name, note: ing.note, roundHint: false, text: join("", ing) };
  }
  const f = ing.scalable ? factor : 1;
  let a: Amount = {
    quantity: ing.quantity * f,
    quantityMax: ing.quantityMax != null ? ing.quantityMax * f : null,
    unit: ing.unit,
  };
  a = system === "metric" ? toMetric(a, ing.name) : smoothUS(toUS(a));

  const label = a.unit ? ` ${unitLabel(a.unit, a.quantityMax ?? a.quantity)}` : "";
  const amount = `${formatRange(a.quantity, a.quantityMax)}${label}`;
  const roundHint =
    !a.unit && ing.scalable && f !== 1 && formatQuantity(a.quantity) !== String(Math.round(a.quantity));
  return { amount, name: ing.name, note: ing.note, roundHint, text: join(amount, ing) };
}

function join(amount: string, ing: Ingredient): string {
  const base = [amount, ing.name].filter(Boolean).join(" ");
  return ing.note ? `${base}, ${ing.note}` : base;
}

/** Ingredient as it should appear in an editable text box (no unit conversion). */
export function rawIngredientText(ing: Ingredient): string {
  const amount =
    ing.quantity === null
      ? ""
      : `${formatRange(ing.quantity, ing.quantityMax)}${
          ing.unit ? ` ${unitLabel(ing.unit, ing.quantityMax ?? ing.quantity)}` : ""
        }`;
  return join(amount, ing);
}
