import Link from "next/link";
import type { Recipe } from "@/lib/recipe/types";
import { RecipeImage } from "./RecipeImage";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const mins = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <RecipeImage url={recipe.imageUrl} title={recipe.title} className="h-40 w-full" />
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{recipe.title}</h3>
          {recipe.favorite && <span title="Favorite">⭐</span>}
        </div>
        <p className="text-sm text-muted">
          {recipe.ingredients.length} ingredients{mins ? ` · ${mins} min` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {recipe.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-navy-soft px-2.5 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
