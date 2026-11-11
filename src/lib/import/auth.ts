import { createClient } from "@supabase/supabase-js";
import { ImportError } from "./types";

export interface AppUser {
  id: string;
  email?: string;
}

/**
 * Who is calling? With Supabase configured, requires a valid Supabase session token
 * from the allowed Google account. Without it, only local development is allowed,
 * so a deployed site can never spend AI money for anonymous visitors.
 */
export async function requireUser(req: Request): Promise<AppUser> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    if (process.env.NODE_ENV === "production")
      throw new ImportError("Sign-in is not set up yet.", "unauthorized");
    return { id: "dev-user", email: "dev@localhost" };
  }
  const token = /^Bearer (.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new ImportError("Please sign in.", "unauthorized");
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ImportError("Please sign in again.", "unauthorized");
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const email = data.user.email ?? "(no email)";
  // Say what the server saw about the caller's own account, but never reveal the allowed address.
  if (!allowed)
    throw new ImportError(
      `You are signed in as ${email}, but the server has no ALLOWED_EMAIL setting. Add it in Netlify and redeploy.`,
      "unauthorized",
    );
  if (data.user.email?.toLowerCase() !== allowed)
    throw new ImportError(
      `This account is not allowed. The server saw ${email}. Check that it matches the ALLOWED_EMAIL setting exactly.`,
      "unauthorized",
    );
  return { id: data.user.id, email: data.user.email ?? undefined };
}
