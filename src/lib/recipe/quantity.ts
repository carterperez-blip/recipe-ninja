const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6", "⅚": "5/6",
};

const GLYPHS: [number, string][] = [
  [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
];

/** Replace unicode fractions with ascii ("1½" -> "1 1/2"). */
export function normalizeFractions(s: string): string {
  return s.replace(/(\d)?([¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])/g, (_m, d, f) =>
    (d ? `${d} ` : "") + UNICODE_FRACTIONS[f],
  );
}

const NUM = String.raw`(?:\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)`;
const LEADING = new RegExp(
  String.raw`^\s*(${NUM})(?:\s*(?:-|–|—|to)\s*(${NUM}))?\s*`,
);

function toNumber(tok: string): number {
  const parts = tok.trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (p.includes("/")) {
      const [a, b] = p.split("/").map(Number);
      total += a / b;
    } else {
      total += parseFloat(p);
    }
  }
  return total;
}

export interface LeadingQuantity {
  min: number;
  max: number | null;
  rest: string;
}

/** Parse a quantity (or range) at the start of a line. null when there is none. */
export function parseLeadingQuantity(line: string): LeadingQuantity | null {
  const m = LEADING.exec(normalizeFractions(line));
  if (!m) return null;
  const min = toNumber(m[1]);
  const max = m[2] ? toNumber(m[2]) : null;
  const rest = normalizeFractions(line).slice(m[0].length);
  return { min, max, rest };
}

/** Format a number as a friendly kitchen quantity: 1.5 -> "1½", 0.33 -> "⅓". */
export function formatQuantity(n: number): string {
  if (!isFinite(n) || n <= 0) return "0";
  if (n >= 10) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : String(r);
  }
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.04) return String(whole || 0);
  if (frac > 0.96) return String(whole + 1);
  for (const [v, glyph] of GLYPHS) {
    if (Math.abs(frac - v) < 0.03) {
      return (whole > 0 ? String(whole) : "") + glyph;
    }
  }
  const r = Math.round(n * 100) / 100;
  return String(r);
}

export function formatRange(min: number, max?: number | null): string {
  if (max != null && max > min) return `${formatQuantity(min)}–${formatQuantity(max)}`;
  return formatQuantity(min);
}
