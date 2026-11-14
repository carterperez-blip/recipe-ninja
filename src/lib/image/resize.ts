/**
 * Shrink a phone photo: longest side `maxSide` px, flattened onto white, re-encoded as JPEG.
 * Used before an upload (storage) and before AI photo import.
 */
export async function fileToJpegBlob(file: File, maxSide = 1568, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("That file could not be read as a picture.");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process that photo.");
  ctx.fillStyle = "#fff"; // flatten transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Your browser could not process that photo.");
  return blob;
}

/** Same, as base64 text for the AI photo import (longest side 1568 px is what the AI reads well). */
export async function fileToJpegBase64(
  file: File,
  maxSide = 1568,
  quality = 0.85,
): Promise<{ mediaType: "image/jpeg"; data: string }> {
  const bytes = new Uint8Array(await (await fileToJpegBlob(file, maxSide, quality)).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mediaType: "image/jpeg", data: btoa(binary) };
}

/** A picture as a data: address, for browser-only (local) mode. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the picture."));
    r.readAsDataURL(blob);
  });
}
