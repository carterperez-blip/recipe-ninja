"use client";
import { useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth } from "@/lib/auth";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { isISODate, planFromRow, planToRow, type PlanEntry, type PlanRow } from "@/lib/plan";
import { timed } from "@/lib/store";

/** Meal plan: Supabase when configured (shared across devices), else this browser. */
const KEY = "recipe-ninja:plan:v1";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const EMPTY: PlanEntry[] = [];

/* ------------------------------ local backend ------------------------------ */
let localCache: { raw: string | null; value: PlanEntry[] } = { raw: null, value: EMPTY };

function readLocal(): PlanEntry[] {
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
      localCache = { raw, value: JSON.parse(raw) as PlanEntry[] };
    } catch {
      localCache = { raw, value: EMPTY };
    }
  }
  return localCache.value;
}

function writeLocal(next: PlanEntry[]) {
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
  entries: PlanEntry[];
  loaded: boolean;
  error: string | null;
}
let cloud: CloudState = { entries: EMPTY, loaded: false, error: null };
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
  const { data, error } = await timed(supabase.from("meal_plan").select("*").order("day", { ascending: true }), "Loading your meal plan").catch(
    (e: Error) => ({ data: null, error: { message: e.message } }),
  );
  if (getAuthState().status !== "signedIn") return;
  if (error) setCloud({ loaded: true, error: `Could not load your meal plan: ${error.message}` });
  else setCloud({ entries: (data as PlanRow[]).map(planFromRow), loaded: true, error: null });
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
      setCloud({ entries: EMPTY, loaded: false, error: null });
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
export function usePlan(): PlanEntry[] {
  return useSyncExternalStore(subscribe, isCloudConfigured ? () => cloud.entries : readLocal, () => EMPTY);
}
export function usePlanReady(): boolean {
  return useSyncExternalStore(subscribe, () => (isCloudConfigured ? cloud.loaded : true), () => false);
}
export function usePlanError(): string | null {
  return useSyncExternalStore(subscribe, () => cloud.error, () => null);
}

/* -------------------------------- mutations -------------------------------- */
function client() {
  const supabase = getSupabase();
  if (!supabase || getAuthState().status !== "signedIn") throw new Error("Please sign in first.");
  return supabase;
}
const current = () => (isCloudConfigured ? cloud.entries : readLocal());
const clampServings = (n: number) => Math.min(50, Math.max(1, Math.round(n)));

export async function addPlanEntry(input: { recipeId: string; day: string; servings: number }): Promise<PlanEntry> {
  if (!isISODate(input.day)) throw new Error("Pick a valid day.");
  const entry: PlanEntry = { id: crypto.randomUUID(), recipeId: input.recipeId, day: input.day, servings: clampServings(input.servings) };
  if (!isCloudConfigured) {
    writeLocal([...current(), entry]);
    return entry;
  }
  const { error } = await timed(client().from("meal_plan").insert(planToRow(entry)), "Saving the plan");
  if (error) throw new Error(error.message);
  setCloud({ entries: [...cloud.entries, entry] });
  return entry;
}

async function update(next: PlanEntry[], write: () => PromiseLike<{ error: { message: string } | null }>) {
  if (!isCloudConfigured) {
    writeLocal(next);
    return;
  }
  const before = cloud.entries;
  setCloud({ entries: next }); // show it right away, undo if saving fails
  try {
    const { error } = await timed(write(), "Saving the plan");
    if (error) throw new Error(error.message);
  } catch (e) {
    setCloud({ entries: before, error: `Could not save that change: ${e instanceof Error ? e.message : "unknown error"}` });
  }
}

export function setPlanServings(id: string, servings: number) {
  const n = clampServings(servings);
  return update(current().map((e) => (e.id === id ? { ...e, servings: n } : e)), () =>
    client().from("meal_plan").update({ servings: n }).eq("id", id),
  );
}

export function removePlanEntry(id: string) {
  return update(current().filter((e) => e.id !== id), () => client().from("meal_plan").delete().eq("id", id));
}
