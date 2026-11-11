import type { Ingredient } from "./types";
import { parseLeadingQuantity } from "./quantity";
import { canonicalUnit } from "./units";

const NON_SCALABLE = /\b(to taste|as needed|for (?:serving|garnish|frying|greasing|dusting)|optional)\b/i;

/** Turn "1 1/2 cups all-purpose flour, sifted" into a structured ingredient. */
export function parseIngredientLine(raw: string): Ingredient {
  const line = raw.replace(/^[\s•*\-–]+/, "").replace(/\s+/g, " ").trim();
  const lead = parseLeadingQuantity(line);

  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let rest = line;
  if (lead) {
    quantity = lead.min;
    quantityMax = lead.max;
    rest = lead.rest.trim();
  }

  // optional parenthetical size such as "(14 oz)" directly after the quantity
  let sizeNote = "";
  const paren = /^\(([^)]*)\)\s*/.exec(rest);
  if (lead && paren) {
    sizeNote = paren[1];
    rest = rest.slice(paren[0].length);
  }

  let unit: string | null = null;
  if (lead) {
    const two = /^([A-Za-z]+\s[A-Za-z]+)\b/.exec(rest);
    const one = /^([A-Za-z]+)\.?\b/.exec(rest);
    const u2 = two ? canonicalUnit(two[1]) : null;
    const u1 = one ? canonicalUnit(one[1]) : null;
    if (u2) { unit = u2; rest = rest.slice(two![0].length).trim(); }
    else if (u1) { unit = u1; rest = rest.slice(one![0].length).trim(); }
    rest = rest.replace(/^of\s+/i, "");
  }

  let name = rest;
  let note = sizeNote;
  const comma = rest.indexOf(",");
  if (comma > -1) {
    name = rest.slice(0, comma).trim();
    note = [note, rest.slice(comma + 1).trim()].filter(Boolean).join(", ");
  }
  const tail = /\(([^)]*)\)\s*$/.exec(name);
  if (tail) {
    note = [note, tail[1]].filter(Boolean).join(", ");
    name = name.slice(0, tail.index).trim();
  }

  const scalable =
    quantity !== null && unit !== "pinch" && unit !== "dash" && !NON_SCALABLE.test(line);

  return {
    quantity,
    quantityMax,
    unit,
    name: name.trim(),
    ...(note ? { note } : {}),
    scalable,
  };
}
