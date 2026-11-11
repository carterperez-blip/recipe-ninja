"use client";
import { useSyncExternalStore } from "react";
import type { Recipe, UnitSystem } from "@/lib/recipe/types";
import { parseIngredientLine } from "@/lib/recipe/parse";
import { fromRow, toRow, type RecipeRow } from "@/lib/recipe/rows";
import { getAuthState, subscribeAuth } from "@/lib/auth";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";

/**
 * Recipe storage with two backends behind the same functions:
 *  - Supabase (when configured): your private library, synced across devices
 *  - this browser's localStorage (when Supabase is not configured): local-only demo mode
 */
const RECIPES_KEY = "recipe-ninja:recipes:v1";
const UNITS_KEY = "recipe-ninja:units:v1";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const EMPTY: Recipe[] = [];

/* ------------------------------ local backend ------------------------------ */

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

let localCache: { raw: string | null; value: Recipe[] } = { raw: null, value: EMPTY };

function readLocal(): Recipe[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECIPES_KEY);
  } catch {
    return localCache.value;
  }
  if (raw === null) {
    const s = seed();
    raw = JSON.stringify(s);
    try {
      window.localStorage.setItem(RECIPES_KEY, raw);
    } catch {
      /* private mode: keep in memory only */
    }
    localCache = { raw, value: s };
    return localCache.value;
  }
  if (raw !== localCache.raw) {
    try {
      localCache = { raw, value: JSON.parse(raw) as Recipe[] };
    } catch {
      localCache = { raw, value: EMPTY };
    }
  }
  return localCache.value;
}

function writeLocal(next: Recipe[]) {
  const raw = JSON.stringify(next);
  localCache = { raw, value: next };
  try {
    window.localStorage.setItem(RECIPES_KEY, raw);
  } catch {
    /* ignore */
  }
  notify();
}

/* ------------------------------ cloud backend ------------------------------ */

interface CloudState {
  recipes: Recipe[];
  loaded: boolean;
  error: string | null;
}
let cloud: CloudState = { recipes: EMPTY, loaded: false, error: null };
let loadingFor: string | null = null;

function setCloud(next: Partial<CloudState>) {
  cloud = { ...cloud, ...next };
  notify();
}

async function loadCloud() {
  const supabase = getSupabase();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signedIn") return;
  loadingFor = auth.session.user.id;
  const { data, error } = await timed(
    supabase.from("recipes").select("*").order("created_at", { ascending: false }),
    "Loading your recipes",
  ).catch((e: Error) => ({ data: null, error: { message: e.message } }));
  if (getAuthState().status !== "signedIn") return; // signed out while loading
  if (error) setCloud({ loaded: true, error: `Could not load your recipes: ${error.message}` });
  else setCloud({ recipes: (data as RecipeRow[]).map(fromRow), loaded: true, error: null });
}

let cloudStarted = false;
function startCloud() {
  if (cloudStarted || !isCloudConfigured || typeof window === "undefined") return;
  cloudStarted = true;
  const onAuth = () => {
    const a = getAuthState();
    if (a.status === "signedIn") {
      if (loadingFor !== a.session.user.id) void loadCloud();
    } else if (a.status === "signedOut") {
      loadingFor = null;
      setCloud({ recipes: EMPTY, loaded: false, error: null });
    }
  };
  subscribeAuth(onAuth);
  onAuth();
  // pick up changes made on another device when you come back to this tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadCloud();
  });
}

function subscribe(cb: () => void) {
  startCloud();
  listeners.add(cb);
  if (!isCloudConfigured) window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    if (!isCloudConfigured) window.removeEventListener("storage", cb);
  };
}

/* --------------------------------- hooks ---------------------------------- */

export function useRecipes(): Recipe[] {
  return useSyncExternalStore(subscribe, isCloudConfigured ? () => cloud.recipes : readLocal, () => EMPTY);
}

/** True once recipes are ready to show (after sign-in and first load in cloud mode). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => (isCloudConfigured ? cloud.loaded : true), () => false);
}

export function useLoadError(): string | null {
  return useSyncExternalStore(subscribe, () => cloud.error, () => null);
}

/* -------------------------------- mutations -------------------------------- */

const WRITE_TIMEOUT_MS = 20_000;

/** Give up on a database call that never answers, so the screen cannot freeze on "Saving…". */
export function timed<T>(work: PromiseLike<T>, what: string, ms = WRITE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} is taking too long, so it may not have saved. Check your connection and try again.`)),
      ms,
    );
  });
  return Promise.race([Promise.resolve(work), timeout]).finally(() => clearTimeout(timer));
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase || getAuthState().status !== "signedIn") throw new Error("Please sign in first.");
  return supabase;
}

export async function saveRecipe(recipe: Recipe): Promise<Recipe> {
  const withId = { ...recipe, id: recipe.id ?? crypto.randomUUID() };
  if (!isCloudConfigured) {
    const all = readLocal();
    const exists = all.some((r) => r.id === withId.id);
    writeLocal(exists ? all.map((r) => (r.id === withId.id ? withId : r)) : [withId, ...all]);
    return withId;
  }
  const { error } = await timed(requireClient().from("recipes").upsert(toRow(withId)), "Saving");
  if (error) {
    console.error("save failed", error);
    throw new Error(error.message);
  }
  const exists = cloud.recipes.some((r) => r.id === withId.id);
  setCloud({
    recipes: exists ? cloud.recipes.map((r) => (r.id === withId.id ? withId : r)) : [withId, ...cloud.recipes],
  });
  return withId;
}

export async function deleteRecipe(id: string): Promise<void> {
  if (!isCloudConfigured) {
    writeLocal(readLocal().filter((r) => r.id !== id));
    return;
  }
  const { error } = await timed(requireClient().from("recipes").delete().eq("id", id), "Deleting");
  if (error) throw new Error(error.message);
  setCloud({ recipes: cloud.recipes.filter((r) => r.id !== id) });
}

/** Small edits (favorite, rating): update the screen first, then save; undo on failure. */
export async function patchRecipe(id: string, patch: Partial<Recipe>): Promise<void> {
  if (!isCloudConfigured) {
    writeLocal(readLocal().map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return;
  }
  const before = cloud.recipes;
  const target = before.find((r) => r.id === id);
  if (!target) return;
  const merged = { ...target, ...patch, id };
  setCloud({ recipes: before.map((r) => (r.id === id ? merged : r)) });
  try {
    const { error } = await timed(requireClient().from("recipes").update(toRow(merged)).eq("id", id), "Saving");
    if (error) throw new Error(error.message);
  } catch (e) {
    setCloud({ recipes: before, error: `Could not save that change: ${e instanceof Error ? e.message : "unknown error"}` });
  }
}

/* ------------------- unit preference (US is the default) ------------------- */
export function setUnitSystem(u: UnitSystem) {
  try {
    window.localStorage.setItem(UNITS_KEY, u);
  } catch {
    /* ignore */
  }
  notify();
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
