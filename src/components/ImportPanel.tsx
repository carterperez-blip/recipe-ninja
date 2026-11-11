"use client";
import { useState } from "react";
import { RecipeForm } from "@/components/RecipeForm";
import { authHeaders } from "@/lib/auth";
import { fileToJpegBase64 } from "@/lib/image/resize";
import type { ImportResult } from "@/lib/import/types";

type Mode = "url" | "text" | "photo" | "manual";
type ApiOk = ImportResult & { budget?: { spentUsd: number; capUsd: number; nearLimit: boolean } };
type ApiErr = { error: string; code: string };

export function ImportPanel() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErr | null>(null);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [formKey, setFormKey] = useState(0);

  /** Next keeps hidden pages alive, so start the next visit from a clean slate. */
  function resetAll() {
    setMode("url");
    setUrl("");
    setText("");
    setFiles([]);
    setError(null);
    setResult(null);
    setFormKey((k) => k + 1);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      let endpoint = "/api/import/text";
      let payload: unknown = { text };
      if (mode === "url") {
        endpoint = "/api/import/url";
        payload = { url };
      } else if (mode === "photo") {
        endpoint = "/api/import/photo";
        payload = { images: await Promise.all(files.map((f) => fileToJpegBase64(f))) };
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok) setError(data as ApiErr);
      else {
        setResult(data as ApiOk);
        setFormKey((k) => k + 1);
      }
    } catch (e) {
      setError({
        error:
          mode === "photo" && e instanceof Error && !/fetch|network/i.test(e.message)
            ? e.message
            : "Could not reach the server. Check your connection.",
        code: "fetch_failed",
      });
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
      className={`rounded-full px-4 py-2 text-sm ${mode === m ? "bg-accent font-semibold text-white" : "bg-navy-soft"}`}
    >
      {label}
    </button>
  );

  // After an import, show the editable preview (same form as manual entry).
  if (result) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl bg-navy-soft p-4 text-sm">
          <p className="font-semibold">
            Review before saving{" "}
            <span className="font-normal text-muted">
              ({result.method === "structured" ? "read from the page's recipe data" : "read by AI"})
            </span>
          </p>
          {result.warnings.map((w) => (
            <p key={w} className="rounded-lg bg-sand px-3 py-1.5">{w}</p>
          ))}
          {result.budget?.nearLimit && (
            <p className="rounded-lg bg-accent-soft px-3 py-1.5">
              AI use this month: ${result.budget.spentUsd.toFixed(2)} of ${result.budget.capUsd}.
            </p>
          )}
          <button type="button" className="underline" onClick={() => setResult(null)}>
            Start over
          </button>
        </div>
        <RecipeForm key={formKey} initial={{ ...result.recipe }} onSaved={resetAll} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="How to add">
        {tab("url", "From a link")}
        {tab("text", "Paste text")}
        {tab("photo", "From a photo")}
        {tab("manual", "Type it in")}
      </div>

      {mode === "manual" ? (
        <RecipeForm key={formKey} onSaved={resetAll} />
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          {mode === "url" ? (
            <>
              <label htmlFor="import-url" className="block text-sm font-medium">Recipe web address</label>
              <input id="import-url" type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </>
          ) : mode === "photo" ? (
            <>
              <label htmlFor="import-photo" className="block text-sm font-medium">
                Photo of a cookbook page, card or handwritten note (up to 3)
              </label>
              <input
                id="import-photo"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
              />
              {files.length > 0 && <p className="text-sm text-muted">{files.length} photo{files.length > 1 ? "s" : ""} selected</p>}
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
            disabled={busy || (mode === "url" ? !url.trim() : mode === "photo" ? files.length === 0 : !text.trim())}
            className="rounded-full bg-accent px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Reading the recipe… this can take about 20 seconds" : "Import recipe"}
          </button>

          {error && (
            <div role="alert" className="space-y-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
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
