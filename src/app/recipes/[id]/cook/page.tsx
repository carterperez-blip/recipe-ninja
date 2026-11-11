"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { ingredientsForStep, parsePeople } from "@/lib/recipe/cook";
import { displayIngredient, scaleFactor } from "@/lib/recipe/scale";
import { DEFAULT_SERVINGS, type Recipe } from "@/lib/recipe/types";
import { convertTemperatures } from "@/lib/recipe/units";
import { markCooked } from "@/lib/cookedStore";
import { todayISO } from "@/lib/plan";
import { setUnitSystem, useHydrated, useRecipes, useUnitSystem } from "@/lib/store";

export default function CookPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CookLoader />
    </Suspense>
  );
}

function CookLoader() {
  const { id } = useParams<{ id: string }>();
  const people = parsePeople(useSearchParams().get("people"), DEFAULT_SERVINGS);
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
  return <CookView key={recipe.id} recipe={recipe} people={people} />;
}

/** Ask the browser to keep the screen on while cooking (where supported). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
      } catch {
        /* not supported, or the battery is low: cooking still works */
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);
}

function CookView({ recipe, people }: { recipe: Recipe; people: number }) {
  const router = useRouter();
  const system = useUnitSystem();
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  useWakeLock();
  // Next keeps hidden pages alive: start from step 1 on every visit
  useLayoutEffect(
    () => () => {
      setStep(0);
      setShowAll(false);
    },
    [],
  );

  const total = recipe.steps.length;
  const factor = scaleFactor(people, recipe.baseServings);
  const shown = recipe.ingredients.map((ing) => displayIngredient(ing, factor, system));
  const last = step >= total - 1;
  const go = (d: number) => setStep((s) => Math.min(Math.max(s + d, 0), Math.max(total - 1, 0)));
  const finish = () => router.push(`/recipes/${recipe.id}`);
  /** Last step: record that it was cooked today, then go back to the recipe. */
  async function finishCooked() {
    try {
      await markCooked({ recipeId: recipe.id!, day: todayISO(), servings: people });
      finish();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not mark it as cooked.");
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, Math.max(total - 1, 0)));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const used = total > 0 ? ingredientsForStep(recipe.steps[step].text, recipe.ingredients) : [];

  return (
    <div
      data-cook
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        setTouchX(null);
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{recipe.title}</p>
          <p className="text-sm text-muted">
            {total > 0 ? `Step ${step + 1} of ${total}` : "No steps yet"} · {people} {people === 1 ? "person" : "people"}
          </p>
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="rounded-full bg-navy-soft px-4 py-2 text-sm font-semibold md:hidden"
        >
          Ingredients
        </button>
        <Link href={`/recipes/${recipe.id}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm">
          Exit
        </Link>
      </header>

      {total > 0 && (
        <div className="h-1.5 bg-navy-soft" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
          <div className="h-full bg-accent transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section aria-label="Current step" className="flex min-w-0 flex-1 flex-col justify-center gap-6 overflow-auto px-6 py-6 md:px-12">
          {total === 0 ? (
            <p className="text-xl">
              This recipe has no steps yet.{" "}
              <Link className="underline" href={`/recipes/${recipe.id}/edit`}>Add some</Link>
            </p>
          ) : (
            <>
              <p className="text-3xl font-semibold leading-snug sm:text-4xl" aria-live="polite">
                {convertTemperatures(recipe.steps[step].text, system)}
              </p>
              {used.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">You will need</p>
                  <ul className="flex flex-wrap gap-2">
                    {used.map((i) => (
                      <li key={i} className="rounded-full bg-accent-soft px-4 py-2 text-lg font-medium">
                        {shown[i].text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {/* All ingredients: a side panel on wide screens, a sheet on phones */}
        <aside
          className={`${showAll ? "block" : "hidden"} fixed inset-x-0 bottom-24 z-10 max-h-[60vh] overflow-auto rounded-t-3xl bg-navy-soft p-5 shadow-lg md:static md:block md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:shadow-none`}
          aria-label="Ingredients"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Ingredients</h2>
            <div className="flex rounded-full bg-surface p-1 text-sm" role="group" aria-label="Units">
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
          <ul className="space-y-2">
            {shown.map((d, i) => (
              <li key={i} className={`flex gap-2 rounded-lg px-2 py-1 ${used.includes(i) ? "bg-accent-soft" : ""}`}>
                <span className="min-w-[4.5rem] font-semibold">{d.amount}</span>
                <span>
                  {d.name}
                  {d.note ? <span className="text-muted">, {d.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <footer className="flex gap-3 border-t border-line bg-bg px-4 py-4">
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="flex-1 rounded-2xl border border-line bg-surface py-4 text-xl font-semibold disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={() => (last ? void finishCooked() : go(1))}
          disabled={total === 0}
          className="flex-[2] rounded-2xl bg-accent py-4 text-xl font-semibold text-white disabled:opacity-40"
        >
          {last ? "Done · mark as cooked" : "Next →"}
        </button>
      </footer>
    </div>
  );
}
