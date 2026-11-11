"use client";
import Link from "next/link";
import { signOut, useAuth } from "@/lib/auth";
import { useGroceryItems } from "@/lib/groceryStore";

/** Header actions: grocery list with a count of items still to buy, and Add recipe. */
export function AccountMenu() {
  const auth = useAuth();
  const toBuy = useGroceryItems().filter((i) => !i.checked).length;
  if (auth.status === "signedOut" || auth.status === "loading") return null;
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/grocery"
        aria-label={`Grocery list, ${toBuy} to buy`}
        className="relative rounded-full border border-line bg-surface px-3 py-2 text-lg leading-none"
      >
        <span aria-hidden>🛒</span>
        {toBuy > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-5 text-white">
            {toBuy}
          </span>
        )}
      </Link>
      <Link
        href="/recipes/new"
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
      >
        + Add recipe
      </Link>
    </div>
  );
}

/** Small footer line with who is signed in and a way to sign out (cloud mode only). */
export function AccountFooter() {
  const auth = useAuth();
  if (auth.status !== "signedIn") return null;
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-2 text-center text-sm text-muted">
      Signed in as {auth.session.user.email} ·{" "}
      <button onClick={() => void signOut()} className="underline">
        Sign out
      </button>
    </footer>
  );
}
