import { cn } from '@/lib/utils';

/** Mountain-and-hill logo mark used by the sidebar and auth screens. Decorative only. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 28" aria-hidden="true" className={cn('h-7 w-9 shrink-0', className)}>
      <path d="M2 24 13 7l6 8 4-5 11 14z" fill="hsl(var(--primary))" />
      <path d="M13 7l3.4 5.2-3.4-1.6-3 2.2z" fill="#FFFFFF" />
      <path d="M2 24c8-5 18-5 32 0z" fill="hsl(var(--brand-teal))" />
    </svg>
  );
}
