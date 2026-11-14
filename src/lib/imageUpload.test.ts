import { describe, expect, it } from "vitest";
import { uploadedPathFromUrl } from "./imageUpload";

const BASE = "https://abc.supabase.co";
const UID = "11111111-1111-1111-1111-111111111111";
const url = (p: string) => `${BASE}/storage/v1/object/public/recipe-images/${p}`;

describe("uploadedPathFromUrl", () => {
  it("returns the path for your own uploaded pictures", () => {
    expect(uploadedPathFromUrl(url(`${UID}/photo.jpg`), BASE, UID)).toBe(`${UID}/photo.jpg`);
  });
  it("ignores pasted links and other websites", () => {
    for (const bad of ["https://images.unsplash.com/x.jpg", "https://evil.example.com/storage/v1/object/public/recipe-images/" + UID + "/a.jpg", "data:image/jpeg;base64,AAAA", "not a url", "", null, undefined])
      expect(uploadedPathFromUrl(bad as string, BASE, UID), String(bad)).toBeNull();
  });
  it("never reaches into another person's folder or climbs out of your own", () => {
    expect(uploadedPathFromUrl(url("22222222-2222-2222-2222-222222222222/a.jpg"), BASE, UID)).toBeNull();
    expect(uploadedPathFromUrl(url(`${UID}/../other/a.jpg`), BASE, UID)).toBeNull();
    expect(uploadedPathFromUrl(url(`${UID}/sub/a.jpg`), BASE, UID)).toBeNull();
    expect(uploadedPathFromUrl(url(`${UID}%2F..%2Fother%2Fa.jpg`), BASE, UID)).toBeNull();
  });
  it("needs a signed-in user and a configured project", () => {
    expect(uploadedPathFromUrl(url(`${UID}/a.jpg`), BASE, undefined)).toBeNull();
    expect(uploadedPathFromUrl(url(`${UID}/a.jpg`), undefined, UID)).toBeNull();
  });
});
