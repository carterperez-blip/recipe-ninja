"use client";
import Link from "next/link";
import { signOut, useAuth } from "@/lib/auth";

export function AccountMenu() {
  const auth = useAuth();
  if (auth.status === "signedOut" || auth.status === "loading") return null;
  return (
    <div className="flex items-center gap-3">
      {auth.status === "signedIn" && (
        <button onClick={() => void signOut()} className="text-sm text-muted underline" title={auth.session.user.email ?? ""}>
          Sign out
        </button>
      )}
      <Link
        href="/recipes/new"
        className="rounded-full bg-lav-strong px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
      >
        + Add recipe
      </Link>
    </div>
  );
}
