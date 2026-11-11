import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { parseRecipeWithClaude, validateImages } from "@/lib/import/claude";
import type { BudgetStore } from "@/lib/import/budget";
import { normalizePexels, normalizeUnsplash, reportUnsplashDownload, searchPhotos } from "./search";

const B64 = "iVBORw0KGgo="; // tiny valid base64
const store = (): BudgetStore => ({ spent: async () => 0, add: async () => {} });

describe("photo validation", () => {
  it("accepts 1-3 supported photos", () => {
    expect(validateImages([{ mediaType: "image/jpeg", data: B64 }])).toHaveLength(1);
    expect(validateImages(Array(3).fill({ mediaType: "image/png", data: B64 }))).toHaveLength(3);
  });
  it("rejects bad input", () => {
    for (const bad of [undefined, [], "x", Array(4).fill({ mediaType: "image/png", data: B64 }),
      [{ mediaType: "application/pdf", data: B64 }], [{ mediaType: "image/png", data: "not base64!!" }],
      [{ mediaType: "image/png", data: "A".repeat(5_000_001) }], [null]])
      expect(() => validateImages(bad)).toThrow();
  });
});

describe("photo import", () => {
  it("sends photos as image blocks and parses the answer", async () => {
    let sent: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const client = {
      beta: { messages: { create: async (req: unknown) => {
        sent = req;
        return { stop_reason: "end_turn", usage: { input_tokens: 2000, output_tokens: 400 }, content: [{ type: "text", text: JSON.stringify({
          is_recipe: true, title: "Grandma's Soup", servings: 6, prep_minutes: 0, cook_minutes: 45,
          ingredients: ["2 carrots", "1 onion"], steps: ["Chop.", "Simmer."], tags: ["soup"], notes: "" }) }] };
      } } },
    } as unknown as Anthropic;
    const r = await parseRecipeWithClaude("", { userId: "u", client, store: store(), images: validateImages([{ mediaType: "image/jpeg", data: B64 }]) });
    expect(r.recipe.title).toBe("Grandma's Soup");
    expect(r.recipe.cookMinutes).toBe(45);
    const content = sent.messages[0].content;
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: B64 } });
    expect(content[1]).toMatchObject({ type: "text" });
    expect(content[1].text).toMatch(/attached photo/);
  });
});

describe("picture search", () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  const pexelsJson = { photos: [{ id: 1, url: "https://pexels.com/photo/1", photographer: "Ann", src: { large: "https://images.pexels.com/1-l.jpg", medium: "https://images.pexels.com/1-m.jpg" } }, { id: 2, src: {} }] };
  const unsplashJson = { results: [{ id: "u1", urls: { regular: "https://images.unsplash.com/r", small: "https://images.unsplash.com/s" }, user: { name: "Bo" }, links: { html: "https://unsplash.com/photos/u1", download_location: "https://api.unsplash.com/photos/u1/download" } }] };

  it("normalizes both providers and drops incomplete entries", () => {
    expect(normalizePexels(pexelsJson)).toEqual([{ id: "pexels-1", url: "https://images.pexels.com/1-l.jpg", thumbUrl: "https://images.pexels.com/1-m.jpg", credit: { name: "Ann", url: "https://pexels.com/photo/1", source: "pexels" } }]);
    const u = normalizeUnsplash(unsplashJson);
    expect(u[0]).toMatchObject({ id: "unsplash-u1", credit: { name: "Bo", source: "unsplash" }, downloadLocation: "https://api.unsplash.com/photos/u1/download" });
    expect(normalizePexels({})).toEqual([]);
  });
  it("searches Pexels when its key is set", async () => {
    process.env.PEXELS_API_KEY = "pk"; delete process.env.UNSPLASH_ACCESS_KEY;
    const f = vi.fn(async () => new Response(JSON.stringify(pexelsJson))) as unknown as typeof fetch;
    const r = await searchPhotos("  lemon   chicken ", f);
    expect(r.provider).toBe("pexels");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.pexels.com");
    expect(decodeURIComponent(url.replace(/\+/g, " "))).toContain("lemon chicken food");
    expect((init.headers as Record<string, string>).authorization).toBe("pk");
  });
  it("falls back to Unsplash", async () => {
    delete process.env.PEXELS_API_KEY; process.env.UNSPLASH_ACCESS_KEY = "uk";
    const f = vi.fn(async () => new Response(JSON.stringify(unsplashJson))) as unknown as typeof fetch;
    const r = await searchPhotos("pasta", f);
    expect(r.provider).toBe("unsplash");
    expect(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1].headers).toEqual({ authorization: "Client-ID uk" });
  });
  it("reports missing keys, empty queries and provider errors", async () => {
    delete process.env.PEXELS_API_KEY; delete process.env.UNSPLASH_ACCESS_KEY;
    await expect(searchPhotos("x")).rejects.toMatchObject({ code: "images_unavailable" });
    process.env.PEXELS_API_KEY = "pk";
    await expect(searchPhotos("   ")).rejects.toBeInstanceOf(Error);
    await expect(searchPhotos("x", (async () => new Response("", { status: 429 })) as typeof fetch)).rejects.toMatchObject({ code: "search_failed" });
    await expect(searchPhotos("x", (async () => { throw new Error("net"); }) as typeof fetch)).rejects.toMatchObject({ code: "search_failed" });
  });
  it("only pings Unsplash download URLs", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "uk";
    const f = vi.fn(async () => new Response("{}")) as unknown as typeof fetch;
    await reportUnsplashDownload("https://evil.example.com/x", f);
    expect(f).not.toHaveBeenCalled();
    await reportUnsplashDownload("https://api.unsplash.com/photos/u1/download", f);
    expect(f).toHaveBeenCalledOnce();
  });
});
