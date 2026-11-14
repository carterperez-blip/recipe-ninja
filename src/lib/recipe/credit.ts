import type { ImageCredit } from "./types";

/** Only web links are allowed as credit links (never javascript: or data: addresses). */
export function safeHttpUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value).trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const SITE = { pexels: "Pexels", unsplash: "Unsplash" } as const;

/** The pieces of a credit line, so a page can link just the name: "Photo by <Name> (CC BY)". */
export function creditParts(c: ImageCredit): { prefix: string; name: string; url: string | null; suffix: string } {
  const suffix = c.source === "other" ? (c.license ? ` (${c.license})` : "") : ` on ${SITE[c.source]}`;
  return { prefix: "Photo by ", name: c.name, url: safeHttpUrl(c.url), suffix };
}

/** Plain-text credit line. */
export function creditLabel(c: ImageCredit): string {
  const p = creditParts(c);
  return `${p.prefix}${p.name}${p.suffix}`;
}

/** Build a credit from what someone typed beside a pasted picture. No name means no credit. */
export function buildManualCredit(input: { name: string; url: string; license: string }): { credit: ImageCredit | null; error?: string } {
  const name = input.name.trim().slice(0, 80);
  const url = input.url.trim();
  const license = input.license.trim().slice(0, 40);
  if (!name) {
    return url || license
      ? { credit: null, error: "Add the photographer's or creator's name for the credit." }
      : { credit: null };
  }
  if (url && !safeHttpUrl(url)) return { credit: null, error: "The credit link must start with http:// or https://." };
  return {
    credit: {
      name,
      source: "other",
      ...(url ? { url: safeHttpUrl(url)! } : {}),
      ...(license ? { license } : {}),
    },
  };
}
