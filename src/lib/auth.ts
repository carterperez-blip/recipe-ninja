"use client";
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";

export type AuthState =
  | { status: "local" } // Supabase not configured: recipes stay in this browser
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; session: Session };

const LOCAL: AuthState = { status: "local" };
const LOADING: AuthState = { status: "loading" };
const SIGNED_OUT: AuthState = { status: "signedOut" };

let state: AuthState = isCloudConfigured ? LOADING : LOCAL;
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

const fromSession = (s: Session | null): AuthState => (s ? { status: "signedIn", session: s } : SIGNED_OUT);

function start() {
  const supabase = getSupabase();
  if (started || !supabase) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => set(fromSession(data.session)));
  // Keep this callback synchronous: it must not call back into supabase.
  supabase.auth.onAuthStateChange((_event, session) => set(fromSession(session)));
}

export function subscribeAuth(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const getAuthState = () => state;

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, () => (isCloudConfigured ? LOADING : LOCAL));
}

export async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}

/** Headers for our own API routes: carries the Supabase access token when signed in. */
export function authHeaders(): Record<string, string> {
  return state.status === "signedIn" ? { authorization: `Bearer ${state.session.access_token}` } : {};
}
