import { requireUser } from "@/lib/import/auth";
import { errorResponse } from "@/lib/import/http";
import { reportUnsplashDownload } from "@/lib/images/search";

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = (await request.json().catch(() => null)) as { downloadLocation?: unknown } | null;
    if (typeof body?.downloadLocation === "string") await reportUnsplashDownload(body.downloadLocation);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
