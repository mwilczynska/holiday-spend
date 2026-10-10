import { cn } from '@/lib/utils';

const SUN = '#F5A524';
const SAND = '#F2D49B';
const RIDGE = '#7F95B5';
const FURROW = '#0E7F72';

/**
 * Logo mark: four small travel scenes stacked in one frame and cross-faded slowly by CSS
 * (`.brand-scene` in globals.css). With reduced motion only the mountains show. Decorative only.
 *
 * Chosen from rendered candidates at the real 28px size (10 October 2026): a layered mountain
 * range, a palm against a sunset sea, field rows with a lone tree, and a dusk skyline with lit
 * windows. Each shares the amber sun, navy shapes and teal base so the cycle reads as one family.
 */
export function BrandMark({ className, animated = true }: { className?: string; animated?: boolean }) {
  const navy = 'hsl(var(--primary))';
  const teal = 'hsl(var(--brand-teal))';
  const blue = 'hsl(var(--brand-blue))';
  return (
    <svg viewBox="0 0 36 28" aria-hidden="true" className={cn('h-7 w-9 shrink-0', className)}>
      {/* Mountains: a near and a far peak, both snow-capped */}
      <g className={animated ? 'brand-scene' : undefined}>
        <circle cx="27" cy="7" r="3" fill={SUN} />
        <path d="M14 24 24 9l10 15z" fill={RIDGE} />
        <path d="M24 9l3 4.5-3-1.4-2.6 1.6z" fill="#FFFFFF" />
        <path d="M1 24 11 6l10 18z" fill={navy} />
        <path d="M11 6l3.4 6-3.4-1.8-3.2 2z" fill="#FFFFFF" />
        <path d="M1 24h34v2H1z" fill={teal} />
      </g>
      {animated ? (
        <>
          {/* Beach: palm against a sun setting into the sea */}
          <g className="brand-scene">
            <circle cx="26" cy="17" r="5.5" fill={SUN} />
            <path d="M1 17h34v6H1z" fill={blue} />
            <path d="M19 19.5h11M23 21.5h6" stroke={SUN} strokeWidth="1" strokeLinecap="round" opacity="0.9" />
            <path d="M1 26c8-5 22-5 34 0z" fill={SAND} />
            <path d="M10 24c0-6 1.5-11 4-15" stroke={navy} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M14 9c-4-2-8-1-10 2 4-1 7-1 10-2zM14 9c3-3 7-3 10 0-4-1-7-1-10 0zM14 9c-2-3-1-6 2-8-1 3-1 5-2 8zM14 9c4-1 7 1 8 4-3-2-5-3-8-4z" fill={teal} />
          </g>
          {/* Plains: field rows running to a lone tree */}
          <g className="brand-scene">
            <circle cx="8" cy="8" r="3.5" fill={SUN} />
            <path d="M1 16c10-2 24-2 34 0v10H1z" fill={teal} />
            <path d="M1 21c8-3 18-3 34-1M1 25c10-3 20-3 34-1" stroke={FURROW} strokeWidth="1.4" fill="none" />
            <path d="M26 16v-4" stroke={navy} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="26" cy="10" r="3.6" fill={navy} />
          </g>
          {/* City: dusk skyline with a spire and lit windows */}
          <g className="brand-scene">
            <circle cx="27" cy="9" r="4" fill={SUN} />
            <path d="M2 24V13h4v11zM7 24V7h5v17zM13 24V16h3v8zM17 24V4l1.5-2L20 4v20zM21 24V12h5v12zM27 24v-6h6v6z" fill={navy} />
            <path d="M9 10h1.5M9 13h1.5M9 16h1.5M23 15h1.5M23 18h1.5" stroke={SUN} strokeWidth="1" />
            <path d="M1 24h34v2H1z" fill={teal} />
          </g>
        </>
      ) : null}
    </svg>
  );
}
