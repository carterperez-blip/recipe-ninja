import { ImportError } from "@/lib/import/types";
import type { ImageCredit } from "@/lib/recipe/types";

export interface Photo {
  id: string;
  /** Full-size picture to store on the recipe. */
  url: string;
  thumbUrl: string;
  credit: ImageCredit;
  /** Unsplash asks apps to ping this when a photo is chosen. */
  downloadLocation?: string;
}

export interface SearchOutcome {
  provider: "pexels" | "unsplash";
  photos: Photo[];
}

const clean = (q: string) => q.replace(/\s+/g, " ").trim().slice(0, 100);

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function normalizePexels(json: Json): Photo[] {
  return (Array.isArray(json.photos) ? json.photos : [])
    .filter((p: Json) => p?.src?.large && p?.src?.medium)
    .map((p: Json) => ({
      id: `pexels-${p.id}`,
      url: p.src.large as string,
      thumbUrl: p.src.medium as string,
      credit: { name: String(p.photographer ?? "Unknown"), url: String(p.url ?? "https://www.pexels.com"), source: "pexels" as const },
    }));
}

export function normalizeUnsplash(json: Json): Photo[] {
  return (Array.isArray(json.results) ? json.results : [])
    .filter((p: Json) => p?.urls?.regular && p?.urls?.small)
    .map((p: Json) => ({
      id: `unsplash-${p.id}`,
      url: p.urls.regular as string,
      thumbUrl: p.urls.small as string,
      credit: { name: String(p.user?.name ?? "Unknown"), url: String(p.links?.html ?? "https://unsplash.com"), source: "unsplash" as const },
      downloadLocation: typeof p.links?.download_location === "string" ? p.links.download_location : undefined,
    }));
}

/** Search free food photos. Uses Pexels if PEXELS_API_KEY is set, else Unsplash if UNSPLASH_ACCESS_KEY is set. */
export async function searchPhotos(query: string, doFetch: typeof fetch = fetch): Promise<SearchOutcome> {
  const q = clean(query);
  if (!q) throw new ImportError("Type what the picture should show.", "bad_url");
  const pexels = process.env.PEXELS_API_KEY;
  const unsplash = process.env.UNSPLASH_ACCESS_KEY;
  if (!pexels && !unsplash)
    throw new ImportError("Picture search is not set up yet (missing photo site key).", "images_unavailable");

  const useUnsplash = !pexels;
  const url = useUnsplash
    ? `https://api.unsplash.com/search/photos?${new URLSearchParams({ query: `${q} food`, per_page: "12", orientation: "landscape", content_filter: "high" })}`
    : `https://api.pexels.com/v1/search?${new URLSearchParams({ query: `${q} food`, per_page: "12", orientation: "landscape" })}`;
  let res: Response;
  try {
    res = await doFetch(url, {
      headers: { authorization: useUnsplash ? `Client-ID ${unsplash}` : pexels! },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ImportError("The photo site did not respond.", "search_failed");
  }
  if (res.status === 429) throw new ImportError("The photo site is busy. Try again in a minute.", "search_failed");
  if (!res.ok) throw new ImportError("The photo search failed.", "search_failed");
  const json = (await res.json().catch(() => ({}))) as Json;
  return useUnsplash
    ? { provider: "unsplash", photos: normalizeUnsplash(json) }
    : { provider: "pexels", photos: normalizePexels(json) };
}

/** Unsplash asks apps to report a download when someone picks a photo. Best effort. */
export async function reportUnsplashDownload(downloadLocation: string, doFetch: typeof fetch = fetch): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation.startsWith("https://api.unsplash.com/")) return;
  await doFetch(downloadLocation, { headers: { authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(5_000) }).catch(() => {});
}
