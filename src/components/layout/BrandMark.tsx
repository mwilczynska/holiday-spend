import { cn } from '@/lib/utils';

/**
 * Logo mark: four small travel scenes (mountains, beach, plains, city) stacked in one frame and
 * cross-faded slowly by CSS (`.brand-scene` in globals.css). With reduced motion only the
 * mountains show. Decorative only.
 */
export function BrandMark({ className, animated = true }: { className?: string; animated?: boolean }) {
  const navy = 'hsl(var(--primary))';
  const teal = 'hsl(var(--brand-teal))';
  return (
    <svg viewBox="0 0 36 28" aria-hidden="true" className={cn('h-7 w-9 shrink-0', className)}>
      {/* Mountains */}
      <g className={animated ? 'brand-scene' : undefined}>
        <path d="M2 24 13 7l6 8 4-5 11 14z" fill={navy} />
        <path d="M13 7l3.4 5.2-3.4-1.6-3 2.2z" fill="#FFFFFF" />
        <path d="M2 24c8-5 18-5 32 0z" fill={teal} />
      </g>
      {animated ? (
        <>
          {/* Beach */}
          <g className="brand-scene">
            <circle cx="26" cy="9" r="4" fill="#F5A524" />
            <path d="M2 19c6-2 12-2 18 0s10 2 14 0v5H2z" fill="hsl(var(--brand-blue))" />
            <path d="M2 24c10-4 22-4 32 0z" fill="#F2D49B" />
            <path d="M10 22c0-5 1-9 3-12" stroke={navy} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M13 10c-3-1-6 0-7 2 3-1 5-1 7-2zm0 0c2-2 5-2 7 0-3 0-5-1-7 0zm0 0c-1-2-1-4 1-6 0 2 0 4-1 6z" fill={teal} />
          </g>
          {/* Plains */}
          <g className="brand-scene">
            <circle cx="9" cy="9" r="3.5" fill="#F5A524" />
            <path d="M2 20c6-4 12-4 18-1s10 2 14-1v6H2z" fill={teal} />
            <path d="M2 24c9-3 20-3 32 0z" fill={navy} />
            <path d="M25 18v-4" stroke={navy} strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="25" cy="12.5" r="3" fill={navy} />
          </g>
          {/* City */}
          <g className="brand-scene">
            <path d="M3 24V14h5v10zM9 24V8h6v16zM16 24V12h4v12zM21 24V5h5v19zM27 24v-9h6v9z" fill={navy} />
            <path d="M11 11h2M11 14h2M11 17h2M23 8h1.5M23 11h1.5M23 14h1.5" stroke="#FFFFFF" strokeWidth="1" />
            <path d="M2 24h32v1.5H2z" fill={teal} />
          </g>
        </>
      ) : null}
    </svg>
  );
}
