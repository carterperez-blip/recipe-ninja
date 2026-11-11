"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { SORT_LABELS, sortRecipes, statsByRecipe, type SortMode } from "@/lib/cooked";
import { useCooked } from "@/lib/cookedStore";
import { useHydrated, useLoadError, useRecipes } from "@/lib/store";

export default function Home() {
  const hydrated = useHydrated();
  const recipes = useRecipes();
  const loadError = useLoadError();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("newest");
  const cooked = useCooked();
  const stats = useMemo(() => statsByRecipe(cooked, recipes), [cooked, recipes]);

  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))].sort(), [recipes]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = recipes.filter((r) => {
      if (favOnly && !r.favorite) return false;
      if (tag && !r.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))
      );
    });
    return sortRecipes(filtered, sort, stats);
  }, [recipes, query, tag, favOnly, sort, stats]);

  if (!hydrated) return <p className="text-muted">Loading your recipes…</p>;

  return (
    <div className="space-y-5">
      {loadError && (
        <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm">{loadError}</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search recipes, ingredients or tags"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recipes"
          className="sm:max-w-sm"
        />
        <select aria-label="Sort recipes" value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="sm:max-w-[12rem]">
          {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
            <option key={m} value={m}>
              {SORT_LABELS[m]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setFavOnly((v) => !v)}
          className={`rounded-full border px-4 py-2 text-sm ${favOnly ? "border-accent bg-sand" : "border-line bg-surface"}`}
          aria-pressed={favOnly}
        >
          ⭐ Favorites
        </button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={`rounded-full px-3 py-1 text-sm ${tag === t ? "bg-accent text-white" : "bg-navy-soft"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="mb-3 text-muted">
            {recipes.length === 0 ? "No recipes yet." : "No recipes match your search."}
          </p>
          <Link href="/recipes/new" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold">
            Add your first recipe
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <RecipeCard key={r.id} recipe={r} cooked={stats.get(r.id!)} />
          ))}
        </div>
      )}
    </div>
  );
}
