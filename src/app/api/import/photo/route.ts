import { requireUser } from "@/lib/import/auth";
import { parseRecipeWithClaude, validateImages } from "@/lib/import/claude";
import { errorResponse } from "@/lib/import/http";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json().catch(() => null)) as { images?: unknown } | null;
    const images = validateImages(body?.images);
    return Response.json(await parseRecipeWithClaude("", { userId: user.id, images }));
  } catch (e) {
    return errorResponse(e);
  }
}
