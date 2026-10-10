'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fmtAud } from './dashboard-chart-parts';

type Status = 'planned' | 'active' | 'completed' | null;

export interface CountryComparisonRow {
  countryId: string;
  countryName: string;
  blockIndex: number | null;
  planned: number;
  actual: number;
  plannedDays: number;
  plannedPerDay: number | null;
  actualPerDay: number | null;
  status: Status;
}

export interface CityComparisonRow {
  legId: number;
  cityName: string;
  countryName: string;
  startDate: string | null;
  planned: number;
  actual: number;
  plannedDays: number;
  plannedPerDay: number | null;
  actualPerDay: number | null;
  status: Status;
}

type View = 'countries' | 'cities';

interface Row {
  key: string;
  name: string;
  subtitle: string | null;
  planned: number;
  actual: number;
  days: number;
  plannedPerDay: number | null;
  actualPerDay: number | null;
  status: Status;
}

const STATUS_PILL: Record<'planned' | 'active' | 'completed', string> = {
  planned: 'bg-slate-100 text-slate-700',
  active: 'bg-info-soft text-blue-700',
  completed: 'bg-success-soft text-success',
};

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmtAud(Math.abs(n))}`;

function formatStart(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : value;
}

/**
 * Planned versus actual by country or by city (one row per stay), searchable, in a scroll area
 * with a sticky header. Per-day figures exclude intercity transport.
 */
export function ComparisonTable({ countries, cities }: { countries: CountryComparisonRow[]; cities: CityComparisonRow[] }) {
  const [view, setView] = useState<View>('countries');
  const [query, setQuery] = useState('');

  const rows = useMemo<Row[]>(() => {
    const source: Row[] = view === 'countries'
      ? countries
        .filter((c) => c.planned > 0 || c.actual > 0)
        .map((c, index) => ({
          key: `${c.countryId}:${c.blockIndex ?? 'actual'}:${index}`,
          name: c.countryName,
          subtitle: null,
          planned: c.planned,
          actual: c.actual,
          days: c.plannedDays,
          plannedPerDay: c.plannedPerDay,
          actualPerDay: c.actualPerDay,
          status: c.status,
        }))
      : cities.map((c) => ({
        key: String(c.legId),
        name: c.cityName,
        subtitle: [c.countryName, formatStart(c.startDate)].filter(Boolean).join(' · '),
        planned: c.planned,
        actual: c.actual,
        days: c.plannedDays,
        plannedPerDay: c.plannedPerDay,
        actualPerDay: c.actualPerDay,
        status: c.status,
      }));
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    // Cities also match on their country, so "peru" lists every Peruvian stay.
    return source.filter((row) => row.name.toLowerCase().includes(needle) || (view === 'cities' && (row.subtitle ?? '').toLowerCase().includes(needle)));
  }, [view, countries, cities, query]);

  const noun = view === 'countries' ? 'countries' : 'cities';

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 className="text-[15px] font-bold">Planned vs actual</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(value) => { setView(value as View); setQuery(''); }} className="gap-0">
            <TabsList className="h-9" aria-label="Compare by">
              <TabsTrigger value="countries" className="px-3 text-xs data-[active]:bg-primary data-[active]:text-primary-foreground">Countries</TabsTrigger>
              <TabsTrigger value="cities" className="px-3 text-xs data-[active]:bg-primary data-[active]:text-primary-foreground">Cities</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="relative block">
            <span className="sr-only">Search {noun}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={view === 'countries' ? 'Search countries' : 'Search cities or countries'}
              className="h-9 w-56 rounded-full pl-9 text-sm"
            />
          </label>
        </div>
      </div>

      <div data-testid="dashboard-comparison-scroll" className="max-h-[28rem] overflow-auto border-t">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead className="text-xs text-slate-600">
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:bg-secondary [&>th]:py-2 [&>th]:font-semibold">
              <th className="pl-5 pr-2 text-left">{view === 'countries' ? 'Country' : 'City'}</th>
              <th className="px-2 text-right"># days</th>
              <th className="px-2 text-right">Planned</th>
              <th className="px-2 text-right">Planned $/day</th>
              <th className="px-2 text-right">Actual</th>
              <th className="px-2 text-right">Actual $/day</th>
              <th className="px-2 text-right">Difference</th>
              <th className="pl-2 pr-5 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = row.actual - row.planned;
              const isOver = diff > 0;
              return (
                <tr key={row.key} className="hover:bg-secondary/60 [&>td]:border-b [&>td]:py-2">
                  <td className="pl-5 pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      {row.status ? (
                        <Badge className={cn('rounded-full border-transparent text-[10px] capitalize', STATUS_PILL[row.status])}>{row.status}</Badge>
                      ) : null}
                    </div>
                    {row.subtitle ? <div className="text-xs text-muted-foreground">{row.subtitle}</div> : null}
                  </td>
                  <td className="px-2 text-right">{row.days}</td>
                  <td className="px-2 text-right">{fmtAud(row.planned)}</td>
                  <td className="px-2 text-right">{row.plannedPerDay != null ? fmtAud(row.plannedPerDay) : '—'}</td>
                  <td className="px-2 text-right">{fmtAud(row.actual)}</td>
                  <td className="px-2 text-right">{row.actualPerDay != null ? fmtAud(row.actualPerDay) : '—'}</td>
                  <td className={cn('px-2 text-right', isOver ? 'text-[#9A4B00]' : 'text-success')}>{fmtSigned(diff)}</td>
                  <td className="pl-2 pr-5 text-right">
                    {row.planned > 0 ? (
                      <Badge
                        className={cn(
                          'border-transparent text-xs',
                          row.actual === 0
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                            : isOver
                              ? 'bg-[#FCE7C8] text-[#9A4B00] hover:bg-[#FCE7C8]'
                              : 'bg-success-soft text-success hover:bg-success-soft'
                        )}
                      >
                        {((row.actual / row.planned) * 100).toFixed(0)}%
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No plan</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? `No ${noun} match “${query.trim()}”.` : `No ${noun} to compare yet.`}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-muted-foreground">
        {rows.length} {rows.length === 1 ? noun.replace(/ies$/, 'y') : noun} · totals include everything; $/day excludes intercity transport.
      </p>
    </section>
  );
}
