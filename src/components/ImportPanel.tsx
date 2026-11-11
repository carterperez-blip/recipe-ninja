"use client";
import { useState } from "react";
import { RecipeForm } from "@/components/RecipeForm";
import { authHeaders } from "@/lib/auth";
import type { ImportResult } from "@/lib/import/types";

type Mode = "url" | "text" | "manual";
type ApiOk = ImportResult & { budget?: { spentUsd: number; capUsd: number; nearLimit: boolean } };
type ApiErr = { error: string; code: string };

export function ImportPanel() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErr | null>(null);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "url" ? "/api/import/url" : "/api/import/text", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify(mode === "url" ? { url } : { text }),
      });
      const data = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok) setError(data as ApiErr);
      else {
        setResult(data as ApiOk);
        setFormKey((k) => k + 1);
      }
    } catch {
      setError({ error: "Could not reach the server. Check your connection.", code: "fetch_failed" });
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      aria-pressed={mode === m}
      className={`rounded-full px-4 py-2 text-sm ${mode === m ? "bg-lav-strong font-semibold text-white" : "bg-lav"}`}
    >
      {label}
    </button>
  );

  // After an import, show the editable preview (same form as manual entry).
  if (result) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl bg-mint p-4 text-sm">
          <p className="font-semibold">
            Review before saving{" "}
            <span className="font-normal text-muted">
              ({result.method === "structured" ? "read from the page's recipe data" : "read by AI"})
            </span>
          </p>
          {result.warnings.map((w) => (
            <p key={w} className="rounded-lg bg-butter px-3 py-1.5">{w}</p>
          ))}
          {result.budget?.nearLimit && (
            <p className="rounded-lg bg-peach px-3 py-1.5">
              AI use this month: ${result.budget.spentUsd.toFixed(2)} of ${result.budget.capUsd}.
            </p>
          )}
          <button type="button" className="underline" onClick={() => setResult(null)}>
            Start over
          </button>
        </div>
        <RecipeForm key={formKey} initial={{ ...result.recipe }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="How to add">
        {tab("url", "From a link")}
        {tab("text", "Paste text")}
        {tab("manual", "Type it in")}
      </div>

      {mode === "manual" ? (
        <RecipeForm />
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          {mode === "url" ? (
            <>
              <label htmlFor="import-url" className="block text-sm font-medium">Recipe web address</label>
              <input id="import-url" type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </>
          ) : (
            <>
              <label htmlFor="import-text" className="block text-sm font-medium">Paste the recipe</label>
              <textarea id="import-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Title, ingredients and steps…" />
            </>
          )}
          <button
            type="button"
            onClick={run}
            disabled={busy || (mode === "url" ? !url.trim() : !text.trim())}
            className="rounded-full bg-lav-strong px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Reading the recipe… this can take about 20 seconds" : "Import recipe"}
          </button>

          {error && (
            <div role="alert" className="space-y-2 rounded-xl bg-peach px-3 py-2 text-sm">
              <p>{error.error}</p>
              {mode === "url" && ["blocked", "fetch_failed", "no_recipe", "not_html", "too_long"].includes(error.code) && (
                <button type="button" className="underline" onClick={() => { setMode("text"); setError(null); }}>
                  Paste the recipe text instead
                </button>
              )}
              {error.code === "ai_budget" && (
                <button type="button" className="underline" onClick={() => { setMode("manual"); setError(null); }}>
                  Type it in by hand
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
