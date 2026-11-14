import { describe, expect, it } from "vitest";
import { buildManualCredit, creditLabel, creditParts, safeHttpUrl } from "./credit";

describe("photo credits", () => {
  it("only allows web links", () => {
    expect(safeHttpUrl("https://commons.wikimedia.org/wiki/File:X.jpg")).toBe("https://commons.wikimedia.org/wiki/File:X.jpg");
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "not a url", "", undefined, null]) expect(safeHttpUrl(bad), String(bad)).toBeNull();
  });
  it("builds a credit for a pasted picture", () => {
    expect(buildManualCredit({ name: "  Xiaoyin Li ", url: "https://example.com/p", license: "CC BY" })).toEqual({
      credit: { name: "Xiaoyin Li", source: "other", url: "https://example.com/p", license: "CC BY" },
    });
    expect(buildManualCredit({ name: "Xiaoyin Li", url: "", license: "" }).credit).toEqual({ name: "Xiaoyin Li", source: "other" });
  });
  it("means no credit when the form is empty, and asks for a name when other fields are filled", () => {
    expect(buildManualCredit({ name: "", url: "", license: "" })).toEqual({ credit: null });
    expect(buildManualCredit({ name: " ", url: "https://x.com", license: "" }).error).toMatch(/name/i);
    expect(buildManualCredit({ name: "", url: "", license: "CC BY" }).error).toMatch(/name/i);
  });
  it("rejects an unsafe credit link", () => {
    expect(buildManualCredit({ name: "A", url: "javascript:alert(1)", license: "" }).error).toMatch(/http/);
  });
  it("trims overly long text", () => {
    const r = buildManualCredit({ name: "n".repeat(200), url: "", license: "l".repeat(100) });
    expect(r.credit!.name).toHaveLength(80);
    expect(r.credit!.license).toHaveLength(40);
  });
  it("writes the credit line for each kind of source", () => {
    expect(creditLabel({ name: "Xiaoyin Li", source: "other", license: "CC BY" })).toBe("Photo by Xiaoyin Li (CC BY)");
    expect(creditLabel({ name: "Xiaoyin Li", source: "other" })).toBe("Photo by Xiaoyin Li");
    expect(creditLabel({ name: "Ann", source: "pexels", url: "https://pexels.com/p" })).toBe("Photo by Ann on Pexels");
    expect(creditLabel({ name: "Bo", source: "unsplash" })).toBe("Photo by Bo on Unsplash");
  });
  it("never links an unsafe address, even from stored data", () => {
    expect(creditParts({ name: "X", source: "other", url: "javascript:alert(1)" }).url).toBeNull();
    expect(creditParts({ name: "X", source: "other", url: "https://ok.com" }).url).toBe("https://ok.com/");
  });
});
