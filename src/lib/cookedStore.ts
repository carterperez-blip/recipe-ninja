"use client";
import { useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth } from "@/lib/auth";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { cookedFromRow, cookedToRow, findCooked, type CookedEntry, type CookedRow } from "@/lib/cooked";
import { isISODate } from "@/lib/plan";
import { timed } from "@/lib/store";

/** Cooked history: Supabase when configured (shared across devices), else this browser. */
const KEY = "recipe-ninja:cooked:v1";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const EMPTY: CookedEntry[] = [];

/* ------------------------------ local backend ------------------------------ */
let localCache: { raw: string | null; value: CookedEntry[] } = { raw: null, value: EMPTY };

function readLocal(): CookedEntry[] {
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
      localCache = { raw, value: JSON.parse(raw) as CookedEntry[] };
    } catch {
      localCache = { raw, value: EMPTY };
    }
  }
  return localCache.value;
}

function writeLocal(next: CookedEntry[]) {
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
  entries: CookedEntry[];
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
  const { data, error } = await timed(
    supabase.from("cooked_log").select("*").order("cooked_on", { ascending: false }),
    "Loading your cooked history",
  ).catch((e: Error) => ({ data: null, error: { message: e.message } }));
  if (getAuthState().status !== "signedIn") return;
  if (error) setCloud({ loaded: true, error: `Could not load your cooked history: ${error.message}` });
  else setCloud({ entries: (data as CookedRow[]).map(cookedFromRow), loaded: true, error: null });
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
export function useCooked(): CookedEntry[] {
  return useSyncExternalStore(subscribe, isCloudConfigured ? () => cloud.entries : readLocal, () => EMPTY);
}
export function useCookedReady(): boolean {
  return useSyncExternalStore(subscribe, () => (isCloudConfigured ? cloud.loaded : true), () => false);
}
export function useCookedError(): string | null {
  return useSyncExternalStore(subscribe, () => cloud.error, () => null);
}

/* -------------------------------- mutations -------------------------------- */
function client() {
  const supabase = getSupabase();
  if (!supabase || getAuthState().status !== "signedIn") throw new Error("Please sign in first.");
  return supabase;
}
const current = () => (isCloudConfigured ? cloud.entries : readLocal());

export type MarkResult = { status: "added" | "exists"; entry: CookedEntry };

/** Record that a recipe was cooked on a day. One entry per recipe per day, so a double tap cannot double count. */
export async function markCooked(input: { recipeId: string; day: string; servings: number | null }): Promise<MarkResult> {
  if (!isISODate(input.day)) throw new Error("Pick a valid day.");
  const existing = findCooked(current(), input.recipeId, input.day);
  if (existing) return { status: "exists", entry: existing };
  const entry: CookedEntry = { id: crypto.randomUUID(), recipeId: input.recipeId, day: input.day, servings: input.servings };
  if (!isCloudConfigured) {
    writeLocal([entry, ...current()]);
    return { status: "added", entry };
  }
  const { error } = await timed(client().from("cooked_log").insert(cookedToRow(entry)), "Saving");
  if (error) throw new Error(error.message);
  setCloud({ entries: [entry, ...cloud.entries] });
  return { status: "added", entry };
}

/** Remove a cooked entry (undo a mistaken tap). */
export async function unmarkCooked(id: string): Promise<void> {
  if (!isCloudConfigured) {
    writeLocal(current().filter((e) => e.id !== id));
    return;
  }
  const before = cloud.entries;
  setCloud({ entries: before.filter((e) => e.id !== id) }); // show it right away, undo if saving fails
  try {
    const { error } = await timed(client().from("cooked_log").delete().eq("id", id), "Saving");
    if (error) throw new Error(error.message);
  } catch (e) {
    setCloud({ entries: before, error: `Could not save that change: ${e instanceof Error ? e.message : "unknown error"}` });
  }
}
