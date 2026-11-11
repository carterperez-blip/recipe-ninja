"use client";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { addDaysISO, relativeDay, todayISO } from "@/lib/plan";
import { addPlanEntry } from "@/lib/planStore";
import type { Recipe } from "@/lib/recipe/types";

/** "Add to meal plan" on a recipe page: pick a day, planned for the people count chosen above. */
export function PlanMenu({ recipe, people }: { recipe: Recipe; people: number }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [other, setOther] = useState("");
  // Next keeps hidden pages alive: start closed on every visit
  useLayoutEffect(
    () => () => {
      setOpen(false);
      setMsg(null);
      setOther("");
    },
    [],
  );

  async function plan(day: string) {
    try {
      await addPlanEntry({ recipeId: recipe.id!, day, servings: people });
      setMsg(`Planned for ${relativeDay(day)} (${people} ${people === 1 ? "person" : "people"}).`);
      setOpen(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not add to the plan.");
    }
  }

  const today = open ? todayISO() : "";
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full rounded-full border-2 border-navy bg-surface py-2 text-sm font-semibold text-navy"
      >
        📅 Add to meal plan
      </button>
      {open && (
        <div className="space-y-2 rounded-2xl bg-surface p-3">
          <p className="text-sm text-muted">Which day?</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, i) => addDaysISO(today, i)).map((d) => (
              <button key={d} onClick={() => void plan(d)} className="rounded-full bg-navy-soft px-3 py-1.5 text-sm">
                {relativeDay(d, today)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" aria-label="Another day" value={other} onChange={(e) => setOther(e.target.value)} />
            <button
              onClick={() => void plan(other)}
              disabled={!other}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className="text-sm" role="status">
          {msg}{" "}
          <Link href="/plan" className="underline">
            View plan
          </Link>
        </p>
      )}
    </div>
  );
}
