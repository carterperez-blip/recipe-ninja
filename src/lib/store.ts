"use client";
import { useSyncExternalStore } from "react";
import type { Recipe, UnitSystem } from "@/lib/recipe/types";
import { parseIngredientLine } from "@/lib/recipe/parse";

/**
 * Browser-local recipe storage. This is the default until Supabase is connected;
 * the shape (Recipe) is the same, so swapping the backend only touches this file.
 */
const RECIPES_KEY = "recipe-ninja:recipes:v1";
const UNITS_KEY = "recipe-ninja:units:v1";
const listeners = new Set<() => void>();
const EMPTY: Recipe[] = [];

function seed(): Recipe[] {
  const ing = (lines: string[]) => lines.map(parseIngredientLine);
  return [
    {
      id: "sample-lemon-chicken",
      title: "Lemon Garlic Chicken",
      baseServings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      imageUrl: null,
      sourceUrl: null,
      ingredients: ing([
        "1 1/2 lb chicken breast",
        "3 cloves garlic, minced",
        "2 tbsp olive oil",
        "1 lemon, juiced",
        "1 tsp dried oregano",
        "salt, to taste",
        "1/2 cup chicken broth",
      ]),
      steps: [
        { text: "Season the chicken with salt and oregano." },
        { text: "Sear in olive oil over medium-high heat for 5 minutes per side." },
        { text: "Add garlic, lemon juice and broth. Simmer for 10 minutes until cooked through." },
        { text: "Rest for 3 minutes, then serve with the pan sauce." },
      ],
      tags: ["dinner", "chicken", "quick"],
      notes: "Sample recipe. Delete it whenever you like.",
      favorite: false,
      rating: null,
    },
    {
      id: "sample-tomato-pasta",
      title: "Simple Tomato Pasta",
      baseServings: 2,
      prepMinutes: 5,
      cookMinutes: 15,
      imageUrl: null,
      sourceUrl: null,
      ingredients: ing([
        "200 g spaghetti",
        "2 tbsp olive oil",
        "2 cloves garlic, sliced",
        "1 can crushed tomatoes",
        "1/4 cup grated parmesan",
        "basil, for garnish",
      ]),
      steps: [
        { text: "Boil the spaghetti in salted water until al dente." },
        { text: "Warm olive oil and garlic gently for 1 minute, then add the tomatoes." },
        { text: "Simmer the sauce for 10 minutes, toss with the pasta and finish with parmesan and basil." },
      ],
      tags: ["dinner", "vegetarian", "pasta"],
      notes: "Sample recipe.",
      favorite: true,
      rating: 4,
    },
  ];
}

let cache: { raw: string | null; value: Recipe[] } = { raw: null, value: EMPTY };

function readRecipes(): Recipe[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECIPES_KEY);
  } catch {
    return cache.value;
  }
  if (raw === null) {
    const s = seed();
    raw = JSON.stringify(s);
    try {
      window.localStorage.setItem(RECIPES_KEY, raw);
    } catch {
      /* private mode: keep in memory only */
    }
    cache = { raw, value: s };
    return cache.value;
  }
  if (raw !== cache.raw) {
    try {
      cache = { raw, value: JSON.parse(raw) as Recipe[] };
    } catch {
      cache = { raw, value: EMPTY };
    }
  }
  return cache.value;
}

function writeRecipes(next: Recipe[]) {
  const raw = JSON.stringify(next);
  cache = { raw, value: next };
  try {
    window.localStorage.setItem(RECIPES_KEY, raw);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useRecipes(): Recipe[] {
  return useSyncExternalStore(subscribe, readRecipes, () => EMPTY);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function saveRecipe(recipe: Recipe): Recipe {
  const all = readRecipes();
  const withId = { ...recipe, id: recipe.id ?? crypto.randomUUID() };
  const exists = all.some((r) => r.id === withId.id);
  writeRecipes(exists ? all.map((r) => (r.id === withId.id ? withId : r)) : [withId, ...all]);
  return withId;
}

export function deleteRecipe(id: string) {
  writeRecipes(readRecipes().filter((r) => r.id !== id));
}

export function patchRecipe(id: string, patch: Partial<Recipe>) {
  writeRecipes(readRecipes().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/* ---- unit preference (US is the default) ---- */
export function setUnitSystem(u: UnitSystem) {
  try {
    window.localStorage.setItem(UNITS_KEY, u);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function readUnits(): UnitSystem {
  try {
    return window.localStorage.getItem(UNITS_KEY) === "metric" ? "metric" : "us";
  } catch {
    return "us";
  }
}

export function useUnitSystem(): UnitSystem {
  return useSyncExternalStore(subscribe, readUnits, () => "us" as UnitSystem);
}
