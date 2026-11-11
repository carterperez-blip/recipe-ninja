const TINTS = ["bg-navy-soft", "bg-accent-soft", "bg-sand"];

/** Recipe photo, or a pastel placeholder when there is none yet. */
export function RecipeImage({ url, title, className = "" }: { url?: string | null; title: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={title} className={`object-cover ${className}`} loading="lazy" />;
  }
  const tint = TINTS[title.length % TINTS.length];
  return (
    <div className={`flex items-center justify-center text-4xl ${tint} ${className}`} aria-hidden>
      🍽️
    </div>
  );
}
