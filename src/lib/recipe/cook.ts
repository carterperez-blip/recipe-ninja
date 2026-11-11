import type { Ingredient } from "./types";
import { singularize } from "./inflect";

/** Words that describe an ingredient but do not identify it. */
const FILLER = new Set(
  ("fresh large small medium extra virgin plain all purpose white black red green yellow sweet hot cold warm " +
    "unsalted salted ground dried chopped minced diced sliced whole boneless skinless grated shredded " +
    "ripe raw frozen canned crushed lean low fat free the and for with or of to taste").split(" "),
);

const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(singularize);

function tokens(name: string): string[] {
  return [...new Set(words(name).filter((w) => w.length >= 3 && !FILLER.has(w)))];
}

/**
 * Which ingredients does this step use? An ingredient counts when all of its key words appear
 * in the step, or when one of its words appears and no other ingredient shares that word.
 * A word shared by several ingredients ("chicken" in breast and broth) points to the first one.
 */
export function ingredientsForStep(stepText: string, ingredients: Ingredient[]): number[] {
  const inStep = new Set(words(stepText));
  const toks = ingredients.map((i) => tokens(i.name));
  const owners = new Map<string, number[]>();
  toks.forEach((ts, idx) => ts.forEach((t) => owners.set(t, [...(owners.get(t) ?? []), idx])));

  const hit = new Set<number>();
  toks.forEach((ts, idx) => {
    if (ts.length > 0 && ts.every((t) => inStep.has(t))) hit.add(idx);
  });
  for (const [token, idxs] of owners) {
    if (!inStep.has(token)) continue;
    if (idxs.length === 1) hit.add(idxs[0]);
    else if (!idxs.some((i) => hit.has(i))) hit.add(idxs[0]); // ambiguous word: first ingredient that has it
  }
  return [...hit].sort((a, b) => a - b);
}

/** People count from a URL value; falls back to the default for anything unusable. */
export function parsePeople(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : fallback;
}
