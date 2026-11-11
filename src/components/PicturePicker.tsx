"use client";
import { useState } from "react";
import { authHeaders } from "@/lib/auth";
import type { Photo } from "@/lib/images/search";
import type { ImageCredit } from "@/lib/recipe/types";

export function PicturePicker({
  defaultQuery,
  onPick,
}: {
  defaultQuery: string;
  onPick: (url: string, credit: ImageCredit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(q: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The photo search failed.");
      setPhotos(data.photos as Photo[]);
      if ((data.photos as Photo[]).length === 0) setError("No photos found. Try different words.");
    } catch (e) {
      setPhotos(null);
      setError(e instanceof Error ? e.message : "The photo search failed.");
    } finally {
      setBusy(false);
    }
  }

  function openPanel() {
    setOpen(true);
    const q = query || defaultQuery;
    setQuery(q);
    if (q.trim() && !photos) void search(q);
  }

  function choose(p: Photo) {
    if (p.downloadLocation) {
      void fetch("/api/images/select", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ downloadLocation: p.downloadLocation }),
      }).catch(() => {});
    }
    onPick(p.url, p.credit);
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={openPanel} className="rounded-full bg-navy-soft px-4 py-1.5 text-sm font-medium">
        Find a picture
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex gap-2">
        <input
          aria-label="Picture search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search(query);
            }
          }}
          placeholder="e.g. lemon chicken"
        />
        <button type="button" onClick={() => void search(query)} disabled={busy || !query.trim()} className="rounded-full bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Search"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">Close</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm">{error}</p>}
      {photos && photos.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => choose(p)} className="block w-full overflow-hidden rounded-xl border border-line" aria-label={`Use photo by ${p.credit.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt="" className="h-24 w-full object-cover" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Free photos from Pexels or Unsplash. The photographer is credited on the recipe.</p>
        </>
      )}
    </div>
  );
}
