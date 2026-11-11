"use client";
import { useLayoutEffect, useState } from "react";
import { cookedSummary, historyFor, shortDate, statsByRecipe } from "@/lib/cooked";
import { markCooked, unmarkCooked, useCooked } from "@/lib/cookedStore";
import { todayISO } from "@/lib/plan";
import type { Recipe } from "@/lib/recipe/types";

/** Cooked count, last-cooked date, and the "Mark as cooked" button for a recipe. */
export function CookedPanel({ recipe, people }: { recipe: Recipe; people: number }) {
  const entries = useCooked();
  const [msg, setMsg] = useState<{ text: string; undoId?: string } | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");
  // Next keeps hidden pages alive: start tidy on every visit
  useLayoutEffect(
    () => () => {
      setMsg(null);
      setOtherOpen(false);
      setOther("");
    },
    [],
  );

  const today = todayISO();
  const stats = statsByRecipe(entries, [recipe]).get(recipe.id!);
  const history = historyFor(entries, recipe.id!);

  async function mark(day: string) {
    try {
      const r = await markCooked({ recipeId: recipe.id!, day, servings: people });
      const when = day === today ? "today" : `on ${shortDate(day, today)}`;
      setMsg(
        r.status === "exists"
          ? { text: `Already marked as cooked ${when}.` }
          : { text: `Marked as cooked ${when}.`, undoId: r.entry.id },
      );
      if (r.status === "added") {
        setOtherOpen(false);
        setOther("");
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not save that." });
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-line bg-surface p-4" aria-label="Cooked history">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 font-medium">{cookedSummary(stats, today)}</p>
        <button onClick={() => void mark(today)} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white">
          ✓ Mark as cooked
        </button>
      </div>

      {msg && (
        <p className="text-sm" role="status">
          {msg.text}{" "}
          {msg.undoId && (
            <button
              className="underline"
              onClick={() => {
                void unmarkCooked(msg.undoId!);
                setMsg({ text: "Undone." });
              }}
            >
              Undo
            </button>
          )}
        </p>
      )}

      <div>
        <button onClick={() => setOtherOpen((v) => !v)} aria-expanded={otherOpen} className="text-sm text-muted underline">
          Cooked it on another day?
        </button>
        {otherOpen && (
          <div className="mt-2 flex items-center gap-2">
            <input type="date" aria-label="Day you cooked it" max={today} value={other} onChange={(e) => setOther(e.target.value)} />
            <button
              onClick={() => void mark(other)}
              disabled={!other || other > today}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">History ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg bg-navy-soft px-3 py-1.5 text-sm">
                <span>
                  {shortDate(h.day, today)}
                  {h.servings ? ` · ${h.servings} ${h.servings === 1 ? "person" : "people"}` : ""}
                </span>
                <button onClick={() => void unmarkCooked(h.id)} aria-label={`Remove ${shortDate(h.day, today)} from history`} className="px-1 text-lg text-muted">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
