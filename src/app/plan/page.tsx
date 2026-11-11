"use client";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import {
  DEFAULT_PLAN_SERVINGS,
  addDaysISO,
  dayLabel,
  entriesForDay,
  groceryDraftsForDays,
  relativeDay,
  startOfWeekISO,
  todayISO,
  weekDays,
  weekLabel,
} from "@/lib/plan";
import { findCooked } from "@/lib/cooked";
import { markCooked, unmarkCooked, useCooked } from "@/lib/cookedStore";
import { addDraftsToGrocery } from "@/lib/groceryStore";
import { addPlanEntry, removePlanEntry, setPlanServings, usePlan, usePlanError, usePlanReady } from "@/lib/planStore";
import { useHydrated, useRecipes } from "@/lib/store";

export default function PlanPage() {
  const ready = usePlanReady();
  const recipesReady = useHydrated();
  const entries = usePlan();
  const recipes = useRecipes();
  const loadError = usePlanError();
  const cooked = useCooked();
  // null = the current week; the date is only read in the browser (never while the page is pre-built)
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [pickDay, setPickDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Next keeps hidden pages alive: come back to the current week, with nothing open
  useLayoutEffect(
    () => () => {
      setWeekStart(null);
      setPickDay(null);
      setQuery("");
      setMsg(null);
    },
    [],
  );

  if (!ready || !recipesReady) return <p className="text-muted">Loading your plan…</p>;

  const today = todayISO();
  const thisWeek = startOfWeekISO(today);
  const start = weekStart ?? thisWeek;
  const days = weekDays(start);
  const isThisWeek = start === thisWeek;
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const weekEntries = days.flatMap((d) => entriesForDay(entries, d, recipes));
  const q = query.trim().toLowerCase();
  const matches = recipes.filter(
    (r) => !q || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)),
  );

  async function addMeal(recipeId: string, day: string) {
    try {
      setError("");
      await addPlanEntry({ recipeId, day, servings: DEFAULT_PLAN_SERVINGS });
      setPickDay(null);
      setQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that meal.");
    }
  }

  async function toGrocery() {
    try {
      setError("");
      const n = await addDraftsToGrocery(groceryDraftsForDays(entries, days, recipes));
      setMsg(
        n === 0
          ? "Nothing new to add."
          : `Added ${weekEntries.length} ${weekEntries.length === 1 ? "meal" : "meals"} to your grocery list.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to the grocery list.");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Meal plan</h1>
      <div className="flex items-center gap-2">
        <button onClick={() => setWeekStart(addDaysISO(start, -7))} aria-label="Previous week" className="rounded-full border border-line bg-surface px-4 py-2">
          ‹
        </button>
        <p className="flex-1 text-center font-semibold" aria-live="polite">{weekLabel(start)}</p>
        <button onClick={() => setWeekStart(addDaysISO(start, 7))} aria-label="Next week" className="rounded-full border border-line bg-surface px-4 py-2">
          ›
        </button>
        {!isThisWeek && (
          <button onClick={() => setWeekStart(null)} className="rounded-full bg-navy-soft px-4 py-2 text-sm font-medium">
            This week
          </button>
        )}
      </div>

      {(loadError || error) && (
        <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
          {loadError || error}
        </p>
      )}

      <ul className="space-y-3">
        {days.map((day) => {
          const meals = entriesForDay(entries, day, recipes);
          return (
            <li
              key={day}
              data-day={day}
              className={`rounded-2xl border bg-surface p-3 ${day === today ? "border-accent" : "border-line"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">
                  {dayLabel(day)}
                  {day === today && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">Today</span>}
                </h2>
                <button
                  onClick={() => {
                    setPickDay(pickDay === day ? null : day);
                    setQuery("");
                  }}
                  aria-expanded={pickDay === day}
                  className="rounded-full bg-navy-soft px-3 py-1 text-sm font-medium"
                >
                  + Add meal
                </button>
              </div>

              {meals.length === 0 && pickDay !== day && <p className="text-sm text-muted">Nothing planned.</p>}

              <ul className="space-y-2">
                {meals.map((e) => {
                  const r = byId.get(e.recipeId)!;
                  return (
                    <li key={e.id} className="space-y-2 rounded-xl bg-navy-soft px-3 py-2">
                      <div className="flex items-start gap-2">
                        <Link href={`/recipes/${r.id}`} className="min-w-0 flex-1 font-medium">
                          {r.title}
                        </Link>
                        <button onClick={() => void removePlanEntry(e.id)} aria-label={`Remove ${r.title} from ${relativeDay(day, today)}`} className="-mt-1 px-1 text-xl text-muted">
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1" role="group" aria-label={`People for ${r.title}`}>
                          <button
                            onClick={() => void setPlanServings(e.id, e.servings - 1)}
                            aria-label={`Fewer people for ${r.title}`}
                            className="h-8 w-8 rounded-full bg-surface font-bold"
                          >
                            −
                          </button>
                          <span className="min-w-[4.5rem] text-center text-sm">
                            {e.servings} {e.servings === 1 ? "person" : "people"}
                          </span>
                          <button
                            onClick={() => void setPlanServings(e.id, e.servings + 1)}
                            aria-label={`More people for ${r.title}`}
                            className="h-8 w-8 rounded-full bg-surface font-bold"
                          >
                            +
                          </button>
                        </div>
                        <Link href={`/recipes/${r.id}/cook?people=${e.servings}`} className="ml-auto rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
                          Cook
                        </Link>
                      </div>
                      {(() => {
                        const done = findCooked(cooked, r.id!, e.day);
                        return (
                          <button
                            onClick={() => {
                              const act = done
                                ? unmarkCooked(done.id)
                                : markCooked({ recipeId: r.id!, day: e.day, servings: e.servings }).then(() => undefined);
                              act.catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save that."));
                            }}
                            disabled={!done && e.day > today}
                            aria-pressed={!!done}
                            className={`rounded-full border px-3 py-1 text-sm ${done ? "border-navy bg-navy text-white" : "border-navy-mid bg-surface"} disabled:opacity-50`}
                            title={!done && e.day > today ? "You can mark it as cooked on the day" : undefined}
                          >
                            {done ? "✓ Cooked" : "Mark as cooked"}
                          </button>
                        );
                      })()}
                    </li>
                  );
                })}
              </ul>

              {pickDay === day && (
                <div className="mt-3 space-y-2 rounded-xl border border-line p-3">
                  <input aria-label="Search recipes" placeholder="Search your recipes" value={query} onChange={(e) => setQuery(e.target.value)} />
                  {recipes.length === 0 ? (
                    <p className="text-sm text-muted">
                      No recipes yet. <Link href="/recipes/new" className="underline">Add one</Link>.
                    </p>
                  ) : (
                    <ul className="max-h-60 space-y-1 overflow-auto">
                      {matches.map((r) => (
                        <li key={r.id}>
                          <button onClick={() => void addMeal(r.id!, day)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-navy-soft">
                            {r.title}
                            {r.tags.length > 0 && <span className="ml-2 text-xs text-muted">{r.tags.slice(0, 3).join(", ")}</span>}
                          </button>
                        </li>
                      ))}
                      {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">No recipes match.</li>}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <button
          onClick={() => void toGrocery()}
          disabled={weekEntries.length === 0}
          className="w-full rounded-full bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          Add this week&apos;s meals to the grocery list
        </button>
        {msg && (
          <p className="text-sm" role="status">
            {msg}{" "}
            <Link href="/grocery" className="underline">
              View list
            </Link>
          </p>
        )}
        <p className="text-xs text-muted">Each meal is scaled to its own number of people. Adding the same week twice adds the amounts twice.</p>
      </div>
    </div>
  );
}
