/** Save text as a file: a normal download, or (on phones) the share sheet so it can go to Files / iCloud Drive. */
export function downloadText(name: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const asFile = (name: string, mime: string, text: string) => new File([text], name, { type: mime });

/** True on touch devices whose browser can share a file (iPhone Safari, Android Chrome). */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare || navigator.maxTouchPoints < 1) return false;
  try {
    return navigator.canShare({ files: [asFile("x.txt", "text/plain", "x")] });
  } catch {
    return false;
  }
}

/** Open the share sheet with the file. Returns false if sharing failed (cancelling counts as done). */
export async function shareText(name: string, mime: string, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [asFile(name, mime, text)], title: name });
    return true;
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError";
  }
}
