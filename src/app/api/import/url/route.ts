import { requireUser } from "@/lib/import/auth";
import { parseRecipeWithClaude } from "@/lib/import/claude";
import { errorResponse } from "@/lib/import/http";
import { fetchPage } from "@/lib/import/safeFetch";
import { extractStructuredRecipe, pageTextForAi } from "@/lib/import/structured";
import { ImportError } from "@/lib/import/types";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    if (typeof body?.url !== "string") throw new ImportError("Send a link to import.", "bad_url");

    const { html, finalUrl } = await fetchPage(body.url);

    // 1) free path: the page publishes its recipe as structured data
    const structured = extractStructuredRecipe(html, finalUrl);
    if (structured) return Response.json(structured);

    // 2) fallback: let Claude read the page text (uses the monthly AI budget)
    const { text, image } = pageTextForAi(html);
    const result = await parseRecipeWithClaude(text, { userId: user.id, sourceUrl: finalUrl, imageUrl: image });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
