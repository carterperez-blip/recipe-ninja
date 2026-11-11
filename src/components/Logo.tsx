export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Recipe Ninja logo">
      <circle cx="24" cy="24" r="22" fill="#ffe1d3" />
      <rect x="2" y="16" width="44" height="14" rx="7" fill="#b19ce8" />
      <circle cx="16" cy="23" r="3.2" fill="#fff" />
      <circle cx="32" cy="23" r="3.2" fill="#fff" />
      <circle cx="16.8" cy="23" r="1.6" fill="#3b3550" />
      <circle cx="32.8" cy="23" r="1.6" fill="#3b3550" />
      <path d="M17 36c4 3 10 3 14 0" stroke="#3b3550" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M44 20c3-1 4 1 3 4 1-3-1-4-3-4z" fill="#b19ce8" />
    </svg>
  );
}
