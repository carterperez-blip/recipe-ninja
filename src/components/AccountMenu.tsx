"use client";
import Link from "next/link";
import { signOut, useAuth } from "@/lib/auth";

/** Header action: Add recipe. */
export function AccountMenu() {
  const auth = useAuth();
  if (auth.status === "signedOut" || auth.status === "loading") return null;
  return (
    <Link
      href="/recipes/new"
      className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
    >
      + Add recipe
    </Link>
  );
}

/** Footer line: a link to the backup page, and who is signed in with a way to sign out (cloud mode). */
export function AccountFooter() {
  const auth = useAuth();
  if (auth.status === "signedOut" || auth.status === "loading") return null;
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-2 text-center text-sm text-muted">
      <Link href="/backup" className="underline">
        Back up your recipes
      </Link>
      {auth.status === "signedIn" && (
        <>
          {" · "}Signed in as {auth.session.user.email} ·{" "}
          <button onClick={() => void signOut()} className="underline">
            Sign out
          </button>
        </>
      )}
    </footer>
  );
}
