import type { ReactNode } from 'react';
import Link from 'next/link';
import { CircleDollarSign, Moon, Plane } from 'lucide-react';
import { InfoPopover } from '@/components/itinerary/InfoPopover';
import { cn } from '@/lib/utils';
import { DestinationScene } from './DestinationScene';
import { fmtAud } from './dashboard-chart-parts';
import type { DerivedLeg, TripPosition } from './trip-position';

export interface StatHelp {
  summary: string;
  items?: Array<{ label: string; description: string }>;
}

export type StatTone = 'default' | 'good' | 'warn';

const TONE_CARD: Record<StatTone, string> = {
  default: 'border-border bg-card',
  good: 'border-[#CDEBD9] bg-success-soft',
  warn: 'border-[#F6D9AE] bg-[#FFF5E6]',
};

const TONE_VALUE: Record<StatTone, string> = {
  default: '',
  good: 'text-success',
  warn: 'text-[#9A4B00]',
};

const TONE_CHIP: Record<StatTone, string> = {
  default: 'bg-info-soft text-blue-700',
  good: 'bg-[#D3EEDD] text-success',
  warn: 'bg-[#FCE7C8] text-[#9A4B00]',
};

/** Headline figure with an icon chip; the tinted tones mark under/over plan. */
export function BentoStat({
  label,
  help,
  value,
  subtext,
  icon,
  tone = 'default',
}: {
  label: string;
  help: StatHelp;
  value: string;
  subtext?: string;
  icon: ReactNode;
  tone?: StatTone;
}) {
  return (
    <section className={cn('rounded-2xl border p-4 sm:px-[18px]', TONE_CARD[tone])}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-1 text-sm font-semibold text-slate-700">
          <span>{label}</span>
          <InfoPopover title={label} summary={help.summary} items={help.items} />
        </h2>
        <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] [&_svg]:h-4 [&_svg]:w-4', TONE_CHIP[tone])}>
          {icon}
        </span>
      </div>
      <p data-testid="dashboard-stat-value" className={cn('mt-1 text-[28px] font-extrabold tracking-tight', TONE_VALUE[tone])}>{value}</p>
      {subtext ? <p className="text-xs text-muted-foreground">{subtext}</p> : null}
    </section>
  );
}

/** Smaller secondary figure, optionally with a progress bar. */
export function BentoMiniStat({
  label,
  help,
  value,
  unit,
  subtext,
  progress,
  progressClassName = 'bg-brand-blue',
}: {
  label: string;
  help: StatHelp;
  value: string;
  unit?: string;
  subtext?: string;
  progress?: number | null;
  progressClassName?: string;
}) {
  return (
    <section className="rounded-2xl border bg-card px-4 py-3.5">
      <p data-testid="dashboard-stat-value" className="text-[22px] font-extrabold tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span> : null}
      </p>
      <h2 className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <InfoPopover title={label} summary={help.summary} items={help.items} />
      </h2>
      {progress != null ? (
        <div
          className="mt-2 h-1.5 rounded-full bg-slate-200/70"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className={cn('h-1.5 rounded-full', progressClassName)} style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
        </div>
      ) : null}
      {subtext ? <p className="mt-1 text-xs text-muted-foreground">{subtext}</p> : null}
    </section>
  );
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function legDateRange(leg: DerivedLeg) {
  return `${formatShortDate(leg.startDate)} – ${formatShortDate(leg.endDate)}`;
}

// The burn series has one point per calendar day, so leg lengths here are days, not nights.
function daysLabel(n: number) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

export function CurrentDestinationCard({ position }: { position: TripPosition }) {
  const leg = position.current;
  if (!leg) {
    return (
      <section className="flex flex-col justify-center gap-2 rounded-2xl border bg-card p-5">
        <h2 className="text-[15px] font-bold">Current destination</h2>
        <p className="text-sm text-muted-foreground">
          Not on a planned leg at the dashboard cutoff date.
          {position.next ? ` Next is ${position.next.cityName} from ${formatShortDate(position.next.startDate)}.` : ''}
        </p>
        <Link href="/plan" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Open the planner →</Link>
      </section>
    );
  }

  const remaining = leg.planned - leg.actual;
  const isOver = remaining < 0;
  const perDayLeft = leg.nightsLeft > 0 && remaining > 0 ? remaining / leg.nightsLeft : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:px-[18px]">
      <h2 className="text-[15px] font-bold">Current destination</h2>
      <div className="relative h-[150px] overflow-hidden rounded-xl">
        <DestinationScene name={leg.cityName} />
        <span className="absolute right-2.5 top-2.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
          In progress
        </span>
      </div>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-extrabold">{leg.cityName}</span>
          {leg.countryName ? <span className="text-muted-foreground">{leg.countryName}</span> : null}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {legDateRange(leg)} · day {leg.dayOfLeg} of {leg.nights}
        </p>
      </div>
      <div className="flex flex-wrap gap-5 border-t pt-3">
        <div className="flex items-center gap-2.5">
          <CircleDollarSign className="h-5 w-5 text-brand-teal" aria-hidden="true" />
          <div>
            <p className="font-bold">{fmtAud(leg.actual)} <span className="font-medium text-muted-foreground">of {fmtAud(leg.planned)}</span></p>
            <p className="text-xs text-muted-foreground">spent on this leg</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Moon className="h-5 w-5 text-brand-blue" aria-hidden="true" />
          <div>
            {isOver ? (
              <>
                <p className="font-bold text-[#9A4B00]">{fmtAud(-remaining)} over</p>
                <p className="text-xs text-muted-foreground">this leg&apos;s plan</p>
              </>
            ) : (
              <>
                <p className="font-bold">{perDayLeft != null ? `${fmtAud(perDayLeft)} / day` : fmtAud(remaining)}</p>
                <p className="text-xs text-muted-foreground">
                  {leg.nightsLeft > 0 ? `left for ${daysLabel(leg.nightsLeft)}` : 'left on the last day'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function UpNextCard({ leg, isFirst }: { leg: DerivedLeg | null; isFirst: boolean }) {
  if (!leg) {
    return (
      <section className="flex flex-col justify-center gap-2 rounded-2xl border bg-card p-5">
        <h2 className="text-[15px] font-bold">Up next</h2>
        <p className="text-sm text-muted-foreground">No further legs are planned.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative min-h-[170px] flex-1">
        <DestinationScene name={leg.cityName} className="absolute inset-0" />
        <span className="absolute left-3 top-3 rounded-full bg-card px-2.5 py-1 text-xs font-bold">
          {isFirst ? 'First stop' : 'Up next'}
        </span>
      </div>
      <div className="space-y-1 px-4 py-3.5">
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="text-[17px] font-extrabold">{leg.cityName}</span>
          {leg.countryName ? <span className="text-sm font-normal text-muted-foreground">{leg.countryName}</span> : null}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {legDateRange(leg)} · {daysLabel(leg.nights)} · {fmtAud(leg.planned)} planned
        </p>
        <Link href="/plan" className="inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-blue-700 hover:text-blue-900">
          <Plane className="h-3.5 w-3.5" aria-hidden="true" />
          View in planner
        </Link>
      </div>
    </section>
  );
}

export function TripProgressCard({ spent, budget }: { spent: number; budget: number }) {
  const ratio = budget > 0 ? spent / budget : null;
  const circumference = 2 * Math.PI * 48;
  const shown = ratio == null ? 0 : Math.min(Math.max(ratio, 0), 1);
  const remaining = budget - spent;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:px-[18px]">
      <h2 className="text-[15px] font-bold">Trip progress</h2>
      <svg
        viewBox="0 0 120 120"
        className="h-[150px] w-[150px] self-center"
        role="img"
        aria-label={ratio == null ? 'No budget set' : `${Math.round(ratio * 100)} percent of budget spent`}
      >
        <circle cx="60" cy="60" r="48" fill="none" stroke="#E7ECF3" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke={ratio != null && ratio > 1 ? '#D97706' : 'hsl(var(--brand-blue))'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${shown * circumference} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="58" textAnchor="middle" fontWeight="800" fontSize="22" fill="currentColor">
          {ratio == null ? '—' : `${Math.round(ratio * 100)}%`}
        </text>
        <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#5A6478">of budget</text>
      </svg>
      <div className="space-y-1.5 text-[13px]">
        <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-blue" /> <span className="font-bold">{fmtAud(spent)}</span> spent</p>
        <p className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="font-bold">{fmtAud(Math.abs(remaining))}</span> {remaining >= 0 ? 'remaining' : 'over budget'}
        </p>
      </div>
      <p className="text-[13px]"><span className="font-bold">{fmtAud(budget)}</span> total budget</p>
    </section>
  );
}
