import type { Recipe } from "@/lib/recipe/types";

export type RecipeDraft = Omit<Recipe, "id">;

export interface ImportResult {
  recipe: RecipeDraft;
  /** Things the user should check in the preview. */
  warnings: string[];
  /** structured = read from the page's recipe markup; ai = parsed by Claude. */
  method: "structured" | "ai";
}

export class ImportError extends Error {
  constructor(
    message: string,
    /** Machine-readable reason so the UI can offer the right fallback. */
    public code:
      | "bad_url"
      | "blocked"
      | "fetch_failed"
      | "not_html"
      | "no_recipe"
      | "ai_unavailable"
      | "ai_budget"
      | "ai_declined"
      | "ai_failed"
      | "too_long"
      | "unauthorized"
      | "bad_image"
      | "images_unavailable"
      | "search_failed",
  ) {
    super(message);
  }
}
