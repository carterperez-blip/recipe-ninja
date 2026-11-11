import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** True when the Supabase environment variables were provided at build time. */
export const isCloudConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

let client: SupabaseClient | null = null;

/** Browser-only Supabase client (session kept in the browser, refreshed automatically). */
export function getSupabase(): SupabaseClient | null {
  if (!isCloudConfigured || typeof window === "undefined") return null;
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  });
  return client;
}
