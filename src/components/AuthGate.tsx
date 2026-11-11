"use client";
import { Logo } from "@/components/Logo";
import { signInWithGoogle, useAuth } from "@/lib/auth";

/** In cloud mode, shows the Google sign-in screen until someone is signed in. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === "local" || auth.status === "signedIn") return <>{children}</>;
  if (auth.status === "loading") return <p className="text-muted">Loading…</p>;
  return (
    <div className="mx-auto mt-10 max-w-sm space-y-5 rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
      <Logo className="mx-auto h-16 w-16" />
      <h1 className="text-2xl font-bold">Recipe Ninja</h1>
      <p className="text-sm text-muted">Sign in to open your recipe library.</p>
      <button
        onClick={() => void signInWithGoogle()}
        className="w-full rounded-full bg-lav-strong px-5 py-3 font-semibold text-white hover:opacity-90"
      >
        Sign in with Google
      </button>
    </div>
  );
}
