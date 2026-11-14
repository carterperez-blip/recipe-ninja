"use client";
import { useState } from "react";
import { useCooked, useCookedReady } from "@/lib/cookedStore";
import { backupFileName, buildBackup, recipesToMarkdown } from "@/lib/export";
import { useGroceryItems, useGroceryReady } from "@/lib/groceryStore";
import { todayISO } from "@/lib/plan";
import { usePlan, usePlanReady } from "@/lib/planStore";
import { canShareFiles, downloadText, shareText } from "@/lib/saveFile";
import { useHydrated, useRecipes } from "@/lib/store";

type Kind = "json" | "md";

export default function BackupPage() {
  const ready = [useHydrated(), useGroceryReady(), usePlanReady(), useCookedReady()].every(Boolean);
  const recipes = useRecipes();
  const grocery = useGroceryItems();
  const plan = usePlan();
  const cooked = useCooked();
  const [msg, setMsg] = useState<string | null>(null);

  if (!ready) return <p className="text-muted">Loading your library…</p>;

  const file = (kind: Kind) => {
    const today = todayISO();
    return kind === "json"
      ? {
          name: backupFileName(today, "json"),
          mime: "application/json",
          text: JSON.stringify(buildBackup({ recipes, grocery, plan, cooked, exportedAt: new Date().toISOString() }), null, 2),
        }
      : { name: backupFileName(today, "md"), mime: "text/markdown", text: recipesToMarkdown(recipes) };
  };

  function save(kind: Kind) {
    const f = file(kind);
    downloadText(f.name, f.mime, f.text);
    setMsg(`Saved ${f.name}. Check your Downloads folder.`);
  }

  async function share(kind: Kind) {
    const f = file(kind);
    const ok = await shareText(f.name, f.mime, f.text);
    setMsg(ok ? `Shared ${f.name}.` : "Sharing did not work. Use Download instead.");
  }

  const counts = [
    [recipes.length, "recipe", "recipes"],
    [grocery.length, "grocery item", "grocery items"],
    [plan.length, "planned meal", "planned meals"],
    [cooked.length, "cooked entry", "cooked entries"],
  ] as const;
  const share_ = canShareFiles();

  const button = (kind: Kind, label: string, primary: boolean) => (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => save(kind)}
        className={`rounded-full px-5 py-3 font-semibold ${primary ? "bg-accent text-white" : "border-2 border-navy bg-surface text-navy"}`}
      >
        {label}
      </button>
      {share_ && (
        <button onClick={() => void share(kind)} className="rounded-full border border-line bg-surface px-5 py-3 font-medium">
          Share or save to Files…
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Back up your recipes</h1>

      <p className="rounded-2xl bg-navy-soft px-4 py-3">
        You have {counts.map(([n, one, many]) => `${n} ${n === 1 ? one : many}`).join(", ")}.
      </p>

      <section className="space-y-2 rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Full backup</h2>
        <p className="text-sm text-muted">
          One file with everything: recipes (with pictures&apos; links and credits), your grocery list, meal plan and cooked history. It holds no passwords or account details.
        </p>
        {button("json", "Download backup (JSON)", true)}
      </section>

      <section className="space-y-2 rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Recipes to read or print</h2>
        <p className="text-sm text-muted">Your recipes as a plain document: ingredients as written, numbered steps, notes. Opens in any text editor or Word.</p>
        {button("md", "Download recipes (Markdown)", false)}
      </section>

      {msg && (
        <p role="status" className="rounded-xl bg-sand px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <p className="text-xs text-muted">
        Keep the backup somewhere safe, such as iCloud Drive or Google Drive. Pictures you uploaded or pasted are saved as links, not inside the file. Restoring from a backup file isn&apos;t built yet; the file has everything needed to do it.
      </p>
    </div>
  );
}
