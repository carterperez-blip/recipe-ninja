import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let email: string | undefined;
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "good" ? { data: { user: { id: "u1", email } }, error: null } : { data: { user: null }, error: new Error("bad") },
    },
  }),
}));

import { requireUser } from "./auth";

const req = (token?: string) => new Request("http://x", { headers: token ? { authorization: `Bearer ${token}` } : {} });
const OLD = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://p.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
});
afterEach(() => {
  process.env = { ...OLD };
});

describe("requireUser", () => {
  it("accepts the allowed account, ignoring case and spaces", async () => {
    email = "Me@Gmail.com";
    process.env.ALLOWED_EMAIL = "  me@gmail.com ";
    await expect(requireUser(req("good"))).resolves.toMatchObject({ id: "u1" });
  });
  it("names the caller's email when it does not match, without revealing the allowed one", async () => {
    email = "other@gmail.com";
    process.env.ALLOWED_EMAIL = "me@gmail.com";
    const err = await requireUser(req("good")).catch((e) => e);
    expect(err.message).toContain("other@gmail.com");
    expect(err.message).not.toContain("me@gmail.com");
    expect(err.code).toBe("unauthorized");
  });
  it("explains a missing ALLOWED_EMAIL setting", async () => {
    email = "me@gmail.com";
    delete process.env.ALLOWED_EMAIL;
    await expect(requireUser(req("good"))).rejects.toThrow(/no ALLOWED_EMAIL setting/);
  });
  it("rejects missing or invalid tokens", async () => {
    await expect(requireUser(req())).rejects.toThrow(/sign in/i);
    await expect(requireUser(req("bad"))).rejects.toThrow(/sign in again/i);
  });
});
