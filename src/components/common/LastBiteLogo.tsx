/**
 * Last Bite logo mark: a fork whose handle becomes a lightning bolt
 * (fast, real-time food rescue). Mirrors public/brand/logo-mark.svg.
 */

interface LastBiteLogoProps {
  className?: string;
  title?: string;
}

export function LastBiteLogo({ className = 'w-10 h-10', title = 'Last Bite' }: LastBiteLogoProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <g fill="var(--background)">
        <rect x="21" y="9" width="5" height="17" rx="2.5" />
        <rect x="29.5" y="9" width="5" height="17" rx="2.5" />
        <rect x="38" y="9" width="5" height="17" rx="2.5" />
        <path d="M21 22h22v3.5c0 4.6-3.4 8.2-7.8 8.5H28.8C24.4 33.7 21 30.1 21 25.5z" />
        <path d="M28.5 33h8.5l-4.2 9.2h6.7L26.2 58.5l3.6-11.7h-6.4z" />
      </g>
    </svg>
  );
}
