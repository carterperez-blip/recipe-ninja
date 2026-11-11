import { ImportError } from "./types";

const STATUS: Record<ImportError["code"], number> = {
  bad_url: 400,
  blocked: 422,
  fetch_failed: 502,
  not_html: 422,
  no_recipe: 422,
  ai_unavailable: 503,
  ai_budget: 429,
  ai_declined: 422,
  ai_failed: 502,
  too_long: 413,
  unauthorized: 401,
  bad_image: 400,
  images_unavailable: 503,
  search_failed: 502,
};

export function errorResponse(e: unknown): Response {
  if (e instanceof ImportError) return Response.json({ error: e.message, code: e.code }, { status: STATUS[e.code] });
  console.error("import failed", e);
  return Response.json({ error: "Something went wrong.", code: "ai_failed" }, { status: 500 });
}
