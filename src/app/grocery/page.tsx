"use client";
import Link from "next/link";
import { useState } from "react";
import { displayGrocery, sortItems, type GroceryItem } from "@/lib/recipe/grocery";
import {
  addGroceryText,
  clearAllGrocery,
  clearCheckedGrocery,
  removeGrocery,
  toggleGrocery,
  useGroceryError,
  useGroceryItems,
  useGroceryReady,
} from "@/lib/groceryStore";
import { setUnitSystem, useUnitSystem } from "@/lib/store";

export default function GroceryPage() {
  const ready = useGroceryReady();
  const items = useGroceryItems();
  const loadError = useGroceryError();
  const system = useUnitSystem();
  const [line, setLine] = useState("");
  const [error, setError] = useState("");
  const { todo, done } = sortItems(items);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!line.trim()) return;
    try {
      setError("");
      await addGroceryText(line);
      setLine("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that item.");
    }
  }

  if (!ready) return <p className="text-muted">Loading your list…</p>;

  const row = (it: GroceryItem) => {
    const d = displayGrocery(it, system);
    return (
      <li key={it.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2">
        <button
          onClick={() => void toggleGrocery(it.id)}
          aria-label={`${it.checked ? "Uncheck" : "Check off"} ${d.name}`}
          aria-pressed={it.checked}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-lg ${it.checked ? "border-accent bg-accent text-white" : "border-navy-mid"}`}
        >
          {it.checked ? "✓" : ""}
        </button>
        <div className={`min-w-0 flex-1 ${it.checked ? "text-muted line-through" : ""}`}>
          <p className="text-lg">
            {d.amount && <span className="font-semibold">{d.amount} </span>}
            {d.name}
          </p>
          {it.recipes.length > 0 && <p className="truncate text-xs text-muted">For {it.recipes.join(", ")}</p>}
        </div>
        <button onClick={() => void removeGrocery(it.id)} aria-label={`Remove ${d.name}`} className="px-2 text-xl text-muted">
          ×
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">Grocery list</h1>
        <div className="flex rounded-full bg-navy-soft p-1 text-sm" role="group" aria-label="Units">
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

      {(loadError || error) && (
        <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
          {loadError || error}
        </p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label="Add an item"
          placeholder="Add an item, e.g. 2 lb onions"
          value={line}
          onChange={(e) => setLine(e.target.value)}
        />
        <button type="submit" disabled={!line.trim()} className="rounded-full bg-accent px-5 font-semibold text-white disabled:opacity-50">
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
          <p>Your list is empty.</p>
          <p className="mt-1 text-sm">
            Open a <Link href="/" className="underline">recipe</Link> and tap <strong>Add to grocery list</strong>.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">{todo.map(row)}</ul>
          {todo.length === 0 && <p className="text-muted">Everything is checked off.</p>}

          {done.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-muted">In the cart ({done.length})</h2>
                <button onClick={() => void clearCheckedGrocery()} className="text-sm underline">
                  Clear checked
                </button>
              </div>
              <ul className="space-y-2">{done.map(row)}</ul>
            </section>
          )}

          <button
            onClick={() => {
              if (confirm("Clear the whole grocery list?")) void clearAllGrocery();
            }}
            className="text-sm text-muted underline"
          >
            Clear everything
          </button>
        </>
      )}
    </div>
  );
}
