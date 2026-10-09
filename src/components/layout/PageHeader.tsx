import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared page title row: teal icon, bold title, muted description and right-aligned actions.
 * Matches the planner's fixed header so every route opens the same way.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Extra lines under the description, such as status or counts. */
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center', className)}>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2.5">
          <Icon className="h-6 w-6 shrink-0 text-brand-teal" aria-hidden="true" />
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        </div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

/** Icon and title only, for pages whose header layout is already bespoke. */
export function PageTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-6 w-6 shrink-0 text-brand-teal" aria-hidden="true" />
      <h1 className="text-2xl font-extrabold tracking-tight">{children}</h1>
    </div>
  );
}

/** Small stat tile used on secondary pages, matching the dashboard's mini stats. */
export function StatTile({
  label,
  value,
  subtext,
  tone = 'default',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  subtext?: ReactNode;
  tone?: 'default' | 'good' | 'warn';
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border px-4 py-3.5',
        tone === 'good' ? 'border-[#CDEBD9] bg-success-soft' : tone === 'warn' ? 'border-[#F6D9AE] bg-[#FFF5E6]' : 'bg-card',
        className
      )}
    >
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      <p
        className={cn(
          'mt-1 text-[22px] font-extrabold tracking-tight',
          tone === 'good' && 'text-success',
          tone === 'warn' && 'text-[#9A4B00]'
        )}
      >
        {value}
      </p>
      {subtext ? <p className="text-xs text-muted-foreground">{subtext}</p> : null}
    </section>
  );
}
