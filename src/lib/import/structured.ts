import * as cheerio from "cheerio";
import { parseIngredientLine } from "@/lib/recipe/parse";
import { DEFAULT_SERVINGS } from "@/lib/recipe/types";
import { isoDurationToMinutes } from "./duration";
import type { ImportResult } from "./types";

type Json = Record<string, unknown>;

const text = (v: unknown): string => {
  if (typeof v !== "string") return "";
  // strip tags and decode entities
  return cheerio.load(`<div>${v}</div>`).text().replace(/\s+/g, " ").trim();
};

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function isRecipeNode(n: unknown): n is Json {
  if (!n || typeof n !== "object") return false;
  const t = (n as Json)["@type"];
  return asArray(t as string | string[]).some((x) => String(x).toLowerCase() === "recipe");
}

/** Walk JSON-LD (arrays, @graph, nested) and return the first Recipe node. */
function findRecipe(node: unknown): Json | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isRecipeNode(node)) return node as Json;
  const graph = (node as Json)["@graph"];
  return graph ? findRecipe(graph) : null;
}

function imageFrom(v: unknown): string | null {
  for (const item of asArray(v as unknown)) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object") {
      const u = (item as Json).url ?? (item as Json).contentUrl;
      if (typeof u === "string" && u.startsWith("http")) return u;
    }
  }
  return null;
}

function stepsFrom(v: unknown): string[] {
  const out: string[] = [];
  const visit = (x: unknown) => {
    if (typeof x === "string") {
      // a single string may hold several lines
      x.split(/\r?\n+/).map(text).filter(Boolean).forEach((s) => out.push(s));
    } else if (Array.isArray(x)) {
      x.forEach(visit);
    } else if (x && typeof x === "object") {
      const o = x as Json;
      if (o.itemListElement) visit(o.itemListElement); // HowToSection
      else if (typeof o.text === "string") out.push(text(o.text));
      else if (typeof o.name === "string") out.push(text(o.name));
    }
  };
  visit(v);
  return out.filter(Boolean);
}

function servingsFrom(v: unknown): number | null {
  for (const item of asArray(v as unknown)) {
    const m = /(\d+(?:\.\d+)?)/.exec(String(item));
    if (m && Number(m[1]) > 0) return Number(m[1]);
  }
  return null;
}

function tagsFrom(r: Json): string[] {
  const raw = [r.keywords, r.recipeCategory, r.recipeCuisine].flatMap((v) =>
    asArray(v as unknown).flatMap((x) => String(x).split(",")),
  );
  return [...new Set(raw.map((t) => text(t).toLowerCase()).filter((t) => t && t.length <= 30))].slice(0, 8);
}

/** Try to read a schema.org Recipe from the page. Returns null when there is none. */
export function extractStructuredRecipe(html: string, sourceUrl: string): ImportResult | null {
  const $ = cheerio.load(html);
  let recipe: Json | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (recipe) return;
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      recipe = findRecipe(JSON.parse(raw));
    } catch {
      /* some sites ship invalid JSON-LD; try the next block */
    }
  });
  if (!recipe) return null;
  const r: Json = recipe;

  const ingredients = asArray(r.recipeIngredient as string[] | string)
    .map((l) => text(l))
    .filter(Boolean)
    .map(parseIngredientLine);
  const steps = stepsFrom(r.recipeInstructions).map((t) => ({ text: t }));
  const title = text(r.name) || text($("title").first().text());
  if (!title || ingredients.length === 0 || steps.length === 0) return null;

  const warnings: string[] = [];
  let baseServings = servingsFrom(r.recipeYield);
  if (baseServings === null) {
    baseServings = DEFAULT_SERVINGS;
    warnings.push("This page did not say how many servings it makes. Check the servings number.");
  }
  const image = imageFrom(r.image) ?? $('meta[property="og:image"]').attr("content") ?? null;
  if (!image) warnings.push("No picture was found on the page. Add one in the preview.");

  return {
    method: "structured",
    warnings,
    recipe: {
      title,
      sourceUrl,
      imageUrl: image,
      baseServings,
      prepMinutes: isoDurationToMinutes(r.prepTime),
      cookMinutes: isoDurationToMinutes(r.cookTime) ?? isoDurationToMinutes(r.totalTime),
      ingredients,
      steps,
      tags: tagsFrom(r),
      notes: "",
      rating: null,
      favorite: false,
    },
  };
}

/** Readable text of a page for the AI fallback: strips scripts, navigation and ads. */
export function pageTextForAi(html: string, maxChars = 24_000): { text: string; image: string | null } {
  const $ = cheerio.load(html);
  const image = $('meta[property="og:image"]').attr("content") ?? null;
  $("script, style, noscript, nav, header, footer, aside, form, iframe, svg").remove();
  const title = $("title").first().text().trim();
  const body = ($("main").length ? $("main") : $("body")).text().replace(/\s+/g, " ").trim();
  return { text: `${title}\n\n${body}`.slice(0, maxChars), image };
}
