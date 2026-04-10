import { Loader2 } from 'lucide-react';

function PlaceholderBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function PageLoadingState({
  title = 'Loading',
  description = 'Preparing the latest planner data.',
  cardCount = 3,
  rowCount = 6,
}: {
  title?: string;
  description?: string;
  cardCount?: number;
  rowCount?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-background/80 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="space-y-2">
            <div className="text-xl font-semibold">{title}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${cardCount > 3 ? 'lg:grid-cols-4 md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
            <PlaceholderBlock className="mb-3 h-3 w-24" />
            <PlaceholderBlock className="h-8 w-28" />
            <PlaceholderBlock className="mt-4 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <PlaceholderBlock className="h-4 w-40" />
          <PlaceholderBlock className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rowCount }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.3fr_0.8fr_0.8fr]">
              <PlaceholderBlock className="h-4 w-4/5" />
              <PlaceholderBlock className="h-4 w-3/4" />
              <PlaceholderBlock className="h-4 w-2/3 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InlineLoadingState({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-muted/40 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Loader2 className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} animate-spin`} />
        </div>
        <div className="space-y-1">
          <div className={`${compact ? 'text-sm' : 'text-sm'} font-medium`}>{title}</div>
          {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingButtonLabel({
  idle,
  loading,
  isLoading,
}: {
  idle: string;
  loading: string;
  isLoading: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <span>{isLoading ? loading : idle}</span>
    </span>
  );
}
