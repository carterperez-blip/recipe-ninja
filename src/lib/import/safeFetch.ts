import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ImportError } from "./types";

/** True for loopback, private, link-local, CGNAT, multicast and cloud-metadata addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("ff")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224
  );
}

/** Validate a user-supplied URL before the server fetches it. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ImportError("That does not look like a web address.", "bad_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new ImportError("Only http and https links are supported.", "bad_url");
  if (url.username || url.password) throw new ImportError("Links with a username or password are not allowed.", "bad_url");
  if (url.port && url.port !== "80" && url.port !== "443")
    throw new ImportError("That port is not allowed.", "blocked");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal"))
    throw new ImportError("That address is not allowed.", "blocked");
  const addrs = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new ImportError("Could not find that website.", "fetch_failed");
      });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address)))
    throw new ImportError("That address is not allowed.", "blocked");
  return url;
}

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 4;

/**
 * Fetch a public web page: checks every redirect hop, limits size and time.
 * Note: DNS is checked before connecting, not pinned to the connection.
 */
export async function fetchPage(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  let url = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; RecipeNinja/1.0; personal recipe importer)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      throw new ImportError("The website did not respond.", "fetch_failed");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429)
      throw new ImportError("That website blocks automatic import.", "blocked");
    if (!res.ok) throw new ImportError(`The website returned an error (${res.status}).`, "fetch_failed");
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type)) throw new ImportError("That link is not a web page.", "not_html");

    const reader = res.body?.getReader();
    if (!reader) throw new ImportError("The page was empty.", "fetch_failed");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new ImportError("That page is too large.", "too_long");
      }
      chunks.push(value);
    }
    return { html: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: url.toString() };
  }
  throw new ImportError("Too many redirects.", "fetch_failed");
}
