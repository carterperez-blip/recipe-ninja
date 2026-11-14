import { getAuthState } from "@/lib/auth";
import { blobToDataUrl, fileToJpegBlob } from "@/lib/image/resize";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { timed } from "@/lib/store";

export const BUCKET = "recipe-images";
export const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** The storage path for one of your own uploaded pictures, or null for any other address. Pure, for tests. */
export function uploadedPathFromUrl(url: string | null | undefined, supabaseUrl: string | undefined, userId: string | undefined): string | null {
  if (!url || !supabaseUrl || !userId) return null;
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    if (u.origin !== base.origin || !u.pathname.startsWith(PUBLIC_PREFIX)) return null;
    const path = decodeURIComponent(u.pathname.slice(PUBLIC_PREFIX.length));
    // only ever your own folder, and no sneaky path tricks
    return path.startsWith(`${userId}/`) && !path.includes("..") && !path.slice(userId.length + 1).includes("/") ? path : null;
  } catch {
    return null;
  }
}

/** True for a picture you uploaded (stored in your Supabase, or kept in this browser in local mode). */
export function isOwnPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  return url.includes(PUBLIC_PREFIX) && !!process.env.NEXT_PUBLIC_SUPABASE_URL && url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function userId(): string | undefined {
  const a = getAuthState();
  return a.status === "signedIn" ? a.session.user.id : undefined;
}

/**
 * Upload a photo for a recipe. The picture is shrunk first (1600 px, JPEG).
 * Cloud mode: saved in your private-library storage, returns its public address.
 * Local mode: kept inside this browser as a small data address.
 */
export async function uploadRecipePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a picture file.");
  if (file.size > MAX_UPLOAD_FILE_BYTES) throw new Error("That picture is too large (the limit is 20 MB).");

  if (!isCloudConfigured) {
    // local mode keeps pictures in browser storage, which is small: shrink harder
    return blobToDataUrl(await fileToJpegBlob(file, 800, 0.7));
  }
  const supabase = getSupabase();
  const uid = userId();
  if (!supabase || !uid) throw new Error("Please sign in first.");
  const blob = await fileToJpegBlob(file, 1600, 0.85);
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await timed(
    supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }),
    "Uploading the picture",
    60_000,
  );
  if (error) {
    throw new Error(
      /bucket/i.test(error.message)
        ? "Picture storage is not set up yet. Run the latest supabase/schema.sql in Supabase."
        : /row-level|policy|unauthorized/i.test(error.message)
          ? "Supabase did not allow the upload. Check that you are signed in and the storage policy from schema.sql exists."
          : error.message,
    );
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Remove a picture you uploaded earlier. Best effort: does nothing for pasted links or other people's files. */
export async function deleteUploadedPhoto(url: string | null | undefined): Promise<void> {
  const path = uploadedPathFromUrl(url, process.env.NEXT_PUBLIC_SUPABASE_URL, userId());
  const supabase = getSupabase();
  if (!path || !supabase) return;
  try {
    await timed(supabase.storage.from(BUCKET).remove([path]), "Removing the old picture", 15_000);
  } catch {
    /* an orphaned file is harmless; do not bother the user */
  }
}
