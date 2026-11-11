import { requireUser } from "@/lib/import/auth";
import { parseRecipeWithClaude } from "@/lib/import/claude";
import { errorResponse } from "@/lib/import/http";
import { ImportError } from "@/lib/import/types";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof body?.text !== "string") throw new ImportError("Paste the recipe text.", "no_recipe");
    return Response.json(await parseRecipeWithClaude(body.text, { userId: user.id }));
  } catch (e) {
    return errorResponse(e);
  }
}
