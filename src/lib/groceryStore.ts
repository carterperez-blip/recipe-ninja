"use client";
import { useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth } from "@/lib/auth";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { parseIngredientLine } from "@/lib/recipe/parse";
import {
  addToList,
  draftsFromIngredients,
  groceryFromRow,
  groceryToRow,
  type GroceryDraft,
  type GroceryItem,
  type GroceryRow,
} from "@/lib/recipe/grocery";
import type { Ingredient } from "@/lib/recipe/types";
import { timed } from "@/lib/store";

/** Grocery list: Supabase when configured (shared across devices), else this browser. */
const KEY = "recipe-ninja:grocery:v1";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const EMPTY: GroceryItem[] = [];

/* ------------------------------ local backend ------------------------------ */
let localCache: { raw: string | null; value: GroceryItem[] } = { raw: null, value: EMPTY };

function readLocal(): GroceryItem[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return localCache.value;
  }
  if (raw === null) return EMPTY;
  if (raw !== localCache.raw) {
    try {
      localCache = { raw, value: JSON.parse(raw) as GroceryItem[] };
    } catch {
      localCache = { raw, value: EMPTY };
    }
  }
  return localCache.value;
}

function writeLocal(next: GroceryItem[]) {
  const raw = JSON.stringify(next);
  localCache = { raw, value: next };
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* ignore */
  }
  notify();
}

/* ------------------------------ cloud backend ------------------------------ */
interface CloudState {
  items: GroceryItem[];
  loaded: boolean;
  error: string | null;
}
let cloud: CloudState = { items: EMPTY, loaded: false, error: null };
let loadingFor: string | null = null;
const setCloud = (p: Partial<CloudState>) => {
  cloud = { ...cloud, ...p };
  notify();
};

async function loadCloud() {
  const supabase = getSupabase();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signedIn") return;
  loadingFor = auth.session.user.id;
  const { data, error } = await timed(
    supabase.from("grocery_items").select("*").order("created_at", { ascending: false }),
    "Loading your grocery list",
  ).catch((e: Error) => ({ data: null, error: { message: e.message } }));
  if (getAuthState().status !== "signedIn") return;
  if (error) setCloud({ loaded: true, error: `Could not load your grocery list: ${error.message}` });
  else setCloud({ items: (data as GroceryRow[]).map(groceryFromRow), loaded: true, error: null });
}

let started = false;
function start() {
  if (started || !isCloudConfigured || typeof window === "undefined") return;
  started = true;
  const onAuth = () => {
    const a = getAuthState();
    if (a.status === "signedIn") {
      if (loadingFor !== a.session.user.id) void loadCloud();
    } else if (a.status === "signedOut") {
      loadingFor = null;
      setCloud({ items: EMPTY, loaded: false, error: null });
    }
  };
  subscribeAuth(onAuth);
  onAuth();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadCloud();
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  if (!isCloudConfigured) window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    if (!isCloudConfigured) window.removeEventListener("storage", cb);
  };
}

/* --------------------------------- hooks ---------------------------------- */
export function useGroceryItems(): GroceryItem[] {
  return useSyncExternalStore(subscribe, isCloudConfigured ? () => cloud.items : readLocal, () => EMPTY);
}
export function useGroceryReady(): boolean {
  return useSyncExternalStore(subscribe, () => (isCloudConfigured ? cloud.loaded : true), () => false);
}
export function useGroceryError(): string | null {
  return useSyncExternalStore(subscribe, () => cloud.error, () => null);
}

/* -------------------------------- mutations -------------------------------- */
function client() {
  const supabase = getSupabase();
  if (!supabase || getAuthState().status !== "signedIn") throw new Error("Please sign in first.");
  return supabase;
}
const current = () => (isCloudConfigured ? cloud.items : readLocal());

async function addDrafts(drafts: GroceryDraft[]): Promise<number> {
  const { list, changed } = addToList(current(), drafts);
  if (changed.length === 0) return 0;
  if (!isCloudConfigured) {
    writeLocal(list);
    return changed.length;
  }
  const { error } = await timed(client().from("grocery_items").upsert(changed.map(groceryToRow)), "Saving the list");
  if (error) throw new Error(error.message);
  setCloud({ items: list });
  return changed.length;
}

/** Add already-built drafts (for example a whole week of planned meals) and merge them into the list. */
export const addDraftsToGrocery = addDrafts;

/** Add a recipe's ingredients, scaled by `factor`, merging with what is already on the list. */
export function addRecipeToGrocery(ingredients: Ingredient[], factor: number, recipeTitle: string) {
  return addDrafts(draftsFromIngredients(ingredients, factor, recipeTitle));
}

/** Add one typed item such as "2 lb onions" or "paper towels". */
export function addGroceryText(line: string) {
  const ing = parseIngredientLine(line);
  const draft: GroceryDraft = { name: ing.name || line.trim(), quantity: ing.quantity === null ? null : (ing.quantityMax ?? ing.quantity), unit: ing.unit };
  return addDrafts([draft]);
}

async function update(next: GroceryItem[], write: () => PromiseLike<{ error: { message: string } | null }>) {
  if (!isCloudConfigured) {
    writeLocal(next);
    return;
  }
  const before = cloud.items;
  setCloud({ items: next }); // show the change right away, undo if saving fails
  try {
    const { error } = await timed(write(), "Saving the list");
    if (error) throw new Error(error.message);
  } catch (e) {
    setCloud({ items: before, error: `Could not save that change: ${e instanceof Error ? e.message : "unknown error"}` });
  }
}

export function toggleGrocery(id: string) {
  const item = current().find((i) => i.id === id);
  if (!item) return Promise.resolve();
  const checked = !item.checked;
  return update(current().map((i) => (i.id === id ? { ...i, checked } : i)), () =>
    client().from("grocery_items").update({ checked }).eq("id", id),
  );
}

export function removeGrocery(id: string) {
  return update(current().filter((i) => i.id !== id), () => client().from("grocery_items").delete().eq("id", id));
}

export function clearCheckedGrocery() {
  const ids = current().filter((i) => i.checked).map((i) => i.id);
  if (ids.length === 0) return Promise.resolve();
  return update(current().filter((i) => !i.checked), () => client().from("grocery_items").delete().in("id", ids));
}

export function clearAllGrocery() {
  const ids = current().map((i) => i.id);
  if (ids.length === 0) return Promise.resolve();
  return update(EMPTY, () => client().from("grocery_items").delete().in("id", ids));
}
