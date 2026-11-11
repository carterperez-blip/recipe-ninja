import { requireUser } from "@/lib/import/auth";
import { errorResponse } from "@/lib/import/http";
import { searchPhotos } from "@/lib/images/search";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return Response.json(await searchPhotos(q));
  } catch (e) {
    return errorResponse(e);
  }
}
