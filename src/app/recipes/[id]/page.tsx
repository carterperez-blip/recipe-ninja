"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useLayoutEffect, useState } from "react";
import { CookedPanel } from "@/components/CookedPanel";
import { PlanMenu } from "@/components/PlanMenu";
import { RecipeImage } from "@/components/RecipeImage";
import { displayIngredient, scaleFactor } from "@/lib/recipe/scale";
import { convertTemperatures } from "@/lib/recipe/units";
import { creditParts } from "@/lib/recipe/credit";
import { DEFAULT_SERVINGS, type ImageCredit, type Recipe } from "@/lib/recipe/types";
import { addRecipeToGrocery } from "@/lib/groceryStore";
import { deleteUploadedPhoto } from "@/lib/imageUpload";
import { deleteRecipe, patchRecipe, setUnitSystem, useHydrated, useRecipes, useUnitSystem } from "@/lib/store";

export default function RecipePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <RecipeLoader />
    </Suspense>
  );
}

function RecipeLoader() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const recipe = useRecipes().find((r) => r.id === id);
  if (!hydrated) return <p className="text-muted">Loading…</p>;
  if (!recipe) {
    return (
      <p>
        Recipe not found. <Link className="underline" href="/">Back to library</Link>
      </p>
    );
  }
  // key = id so every recipe opens at the default number of people
  return <RecipeView key={recipe.id} recipe={recipe} />;
}

function PhotoCredit({ credit }: { credit: ImageCredit }) {
  const c = creditParts(credit);
  return (
    <p className="px-5 pt-2 text-xs text-muted">
      {c.prefix}
      {c.url ? (
        <a href={c.url} target="_blank" rel="noreferrer" className="underline">
          {c.name}
        </a>
      ) : (
        c.name
      )}
      {c.suffix}
    </p>
  );
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const system = useUnitSystem();
  const [people, setPeople] = useState(DEFAULT_SERVINGS);
  const [groceryMsg, setGroceryMsg] = useState<string | null>(null);
  // Next keeps hidden pages alive; reset so every visit opens at the default number of people.
  useLayoutEffect(
    () => () => {
      setPeople(DEFAULT_SERVINGS);
      setGroceryMsg(null);
    },
    [],
  );
  const factor = scaleFactor(people, recipe.baseServings);
  const mins = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <article className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:underline">← All recipes</Link>

      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        <RecipeImage url={recipe.imageUrl} title={recipe.title} className="h-56 w-full sm:h-72" />
        {recipe.imageUrl && recipe.imageCredit && <PhotoCredit credit={recipe.imageCredit} />}
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold">{recipe.title}</h1>
            <button
              onClick={() => patchRecipe(recipe.id!, { favorite: !recipe.favorite })}
              aria-pressed={!!recipe.favorite}
              aria-label="Toggle favorite"
              className="text-2xl"
            >
              {recipe.favorite ? "⭐" : "☆"}
            </button>
          </div>
          <p className="text-sm text-muted">
            {recipe.prepMinutes ? `Prep ${recipe.prepMinutes} min` : ""}
            {recipe.prepMinutes && recipe.cookMinutes ? " · " : ""}
            {recipe.cookMinutes ? `Cook ${recipe.cookMinutes} min` : ""}
            {mins ? ` · Total ${mins} min` : ""}
          </p>
          <div className="flex items-center gap-1" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => patchRecipe(recipe.id!, { rating: recipe.rating === n ? null : n })}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className={(recipe.rating ?? 0) >= n ? "text-accent" : "text-line"}
              >
                ★
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((t) => (
              <span key={t} className="rounded-full bg-navy-soft px-2.5 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        </div>
      </div>

      <CookedPanel recipe={recipe} people={people} />

      {recipe.steps.length > 0 && (
        <Link
          href={`/recipes/${recipe.id}/cook?people=${people}`}
          className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-white shadow-sm hover:opacity-90"
        >
          Start cooking · {people} {people === 1 ? "person" : "people"}
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-4 rounded-3xl bg-navy-soft p-5">
          <h2 className="text-lg font-semibold">Ingredients</h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-surface px-2 py-1" role="group" aria-label="Number of people">
              <button
                onClick={() => setPeople((p) => Math.max(1, p - 1))}
                className="h-8 w-8 rounded-full bg-accent-soft text-lg font-bold"
                aria-label="Fewer people"
              >
                −
              </button>
              <span className="min-w-[5.5rem] text-center text-sm font-semibold" aria-live="polite">
                {people} {people === 1 ? "person" : "people"}
              </span>
              <button
                onClick={() => setPeople((p) => Math.min(50, p + 1))}
                className="h-8 w-8 rounded-full bg-accent-soft text-lg font-bold"
                aria-label="More people"
              >
                +
              </button>
            </div>
            {people !== recipe.baseServings && (
              <button onClick={() => setPeople(recipe.baseServings)} className="text-xs underline">
                Original ({recipe.baseServings})
              </button>
            )}
            <div className="ml-auto flex rounded-full bg-surface p-1 text-sm" role="group" aria-label="Units">
              {(["us", "metric"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnitSystem(u)}
                  aria-pressed={system === u}
                  className={`rounded-full px-3 py-1 ${system === u ? "bg-accent font-semibold text-white" : ""}`}
                >
                  {u === "us" ? "US" : "Metric"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={async () => {
                try {
                  const n = await addRecipeToGrocery(recipe.ingredients, factor, recipe.title);
                  setGroceryMsg(n === 0 ? "Already on your list." : `Added to your grocery list for ${people} ${people === 1 ? "person" : "people"}.`);
                } catch (e) {
                  setGroceryMsg(e instanceof Error ? e.message : "Could not add to the list.");
                }
              }}
              className="w-full rounded-full border-2 border-navy bg-surface py-2 text-sm font-semibold text-navy"
            >
              + Add to grocery list
            </button>
            {groceryMsg && (
              <p className="text-sm" role="status">
                {groceryMsg}{" "}
                <Link href="/grocery" className="underline">
                  View list
                </Link>
              </p>
            )}
          </div>

          <PlanMenu recipe={recipe} people={people} />

          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => {
              const d = displayIngredient(ing, factor, system);
              return (
                <li key={i} className="flex gap-2">
                  <span className="min-w-[4.5rem] font-semibold">{d.amount}</span>
                  <span>
                    {d.name}
                    {d.note ? <span className="text-muted">, {d.note}</span> : null}
                    {d.roundHint ? <span className="ml-1 text-xs text-muted">(round to a whole item)</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3 rounded-3xl bg-accent-soft p-5">
          <h2 className="text-lg font-semibold">Instructions</h2>
          <ol className="space-y-3">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold">
                  {i + 1}
                </span>
                <p className="pt-0.5">{convertTemperatures(s.text, system)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {recipe.notes ? (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm"><strong>Notes:</strong> {recipe.notes}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/recipes/${recipe.id}/edit`} className="rounded-full bg-accent px-4 py-2 font-semibold text-white">
          Edit
        </Link>
        <button
          onClick={async () => {
            if (!confirm(`Delete "${recipe.title}"?`)) return;
            try {
              await deleteRecipe(recipe.id!);
              void deleteUploadedPhoto(recipe.imageUrl); // also remove the stored picture, if it was an upload
              router.push("/");
            } catch (e) {
              alert(e instanceof Error ? e.message : "Could not delete the recipe.");
            }
          }}
          className="rounded-full border border-line bg-surface px-4 py-2"
        >
          Delete
        </button>
        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            Original recipe ↗
          </a>
        )}
      </div>
    </article>
  );
}
