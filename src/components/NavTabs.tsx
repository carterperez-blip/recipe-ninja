"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useGroceryItems } from "@/lib/groceryStore";

/** Main navigation: Recipes, Meal plan, Grocery list (with a count of items still to buy). */
export function NavTabs() {
  const auth = useAuth();
  const path = usePathname();
  const toBuy = useGroceryItems().filter((i) => !i.checked).length;
  if (auth.status === "signedOut" || auth.status === "loading") return null;
  const tabs = [
    { href: "/", label: "Recipes", active: path === "/" || path.startsWith("/recipes") },
    { href: "/plan", label: "Meal plan", active: path.startsWith("/plan") },
    { href: "/grocery", label: "Grocery list", active: path.startsWith("/grocery"), badge: toBuy },
  ];
  return (
    <nav aria-label="Main" className="mx-auto flex max-w-5xl gap-1 px-4 pb-2">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium sm:flex-none sm:px-5 ${t.active ? "bg-navy text-white" : "text-navy hover:bg-navy-soft"}`}
        >
          {t.label}
          {t.badge ? (
            <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-5 text-white" aria-label={`${t.badge} to buy`}>
              {t.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
