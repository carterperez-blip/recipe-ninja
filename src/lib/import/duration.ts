/** "PT1H30M" -> 90, "P0DT45M" -> 45, "PT90S" -> 2 (rounded up). null if unparseable. */
export function isoDurationToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  const total =
    Number(d ?? 0) * 24 * 60 + Number(h ?? 0) * 60 + Number(min ?? 0) + Math.ceil(Number(s ?? 0) / 60);
  return total > 0 ? total : null;
}
