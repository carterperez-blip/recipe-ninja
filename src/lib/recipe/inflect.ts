/** Small, conservative singular/plural helper for counted ingredients ("eggs", "onion"). */
const KEEP = /(ss|us|is|ous)$/i;

export function singularize(word: string): string {
  if (word.length < 4 || KEEP.test(word)) return word;
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/(oes|ches|shes|xes|sses)$/i.test(word)) return word.replace(/es$/i, "");
  if (/s$/i.test(word)) return word.slice(0, -1);
  return word;
}

export function pluralize(word: string): string {
  if (word.length < 3 || /s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return word.replace(/y$/i, "ies");
  if (/(ch|sh|x|o)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Make the last word of a counted ingredient name agree with the amount shown. */
export function agreeWithAmount(name: string, amount: number): string {
  const m = /^(.*?)(\S+)$/.exec(name);
  if (!m) return name;
  const [, head, last] = m;
  return head + (amount > 1 ? pluralize(last) : singularize(last));
}
