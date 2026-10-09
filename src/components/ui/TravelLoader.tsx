import { cn } from '@/lib/utils';

// One plane silhouette pointing along +x, centred on the origin so animateMotion can rotate it.
const PLANE = 'M-8 -1.4 L4 -1.4 Q8 -1.4 8 0 Q8 1.4 4 1.4 L-8 1.4 Z M-1 -1.4 L-5 -8 L-2.6 -8 L3 -1.4 Z M-1 1.4 L-5 8 L-2.6 8 L3 1.4 Z M-7 -1.4 L-9 -5 L-7.4 -5 L-5 -1.4 Z M-7 1.4 L-9 5 L-7.4 5 L-5 1.4 Z';
const ROUTE = 'M24 70 C 80 6, 200 6, 256 70';

/**
 * A plane flying a dashed route between two map pins. Pure SVG/CSS: SMIL moves the plane, CSS
 * animates the dashes and pins (globals.css). Reduced motion shows the plane parked mid-route.
 */
export function TravelLoader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 92" role="img" aria-label="Loading" className={cn('h-auto w-full max-w-[280px]', className)}>
      <path d={ROUTE} fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      <path className="travel-loader-route" d={ROUTE} fill="none" stroke="hsl(var(--brand-blue))" strokeWidth="2" strokeLinecap="round" />
      <g className="travel-loader-pin">
        <path d="M24 58c-5 0-8 3.6-8 8 0 6 8 14 8 14s8-8 8-14c0-4.4-3-8-8-8z" fill="hsl(var(--brand-teal))" />
        <circle cx="24" cy="66" r="3" fill="#FFFFFF" />
      </g>
      <g className="travel-loader-pin travel-loader-pin-end">
        <path d="M256 58c-5 0-8 3.6-8 8 0 6 8 14 8 14s8-8 8-14c0-4.4-3-8-8-8z" fill="#F5A524" />
        <circle cx="256" cy="66" r="3" fill="#FFFFFF" />
      </g>
      <g className="travel-loader-motion">
        <path d={PLANE} fill="hsl(var(--primary))">
          <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto" path={ROUTE} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1" />
        </path>
      </g>
      <path className="travel-loader-static" d={PLANE} fill="hsl(var(--primary))" transform="translate(140 22)" />
    </svg>
  );
}
