'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useInitialPageRefresh } from '@/lib/use-initial-page-refresh';
import { dashboardReadSchema } from '@/lib/dashboard-read-contract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButtonLabel, PageLoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EXPENSE_CATEGORIES } from '@/types';
import Link from 'next/link';
import { CalendarDays, Map, Maximize2, Receipt, TrendingDown, TrendingUp, Users } from 'lucide-react';
import {
  BentoMiniStat,
  BentoStat,
  CurrentDestinationCard,
  TripProgressCard,
  UpNextCard,
  type StatHelp,
} from '@/components/dashboard/DashboardBento';
import { deriveTripPosition } from '@/components/dashboard/trip-position';
import { ComparisonTable, type CityComparisonRow } from '@/components/dashboard/ComparisonTable';
import dynamic from 'next/dynamic';
import {
  DashboardChartPlaceholder,
  buildStaggeredCountryBands,
  fmtAud,
  getBurnRateLegendItems,
  ExpandedChartLegend,
  type BurnRatePoint,
  type CategoryMode,
  type CountryBand,
} from '@/components/dashboard/dashboard-chart-parts';

/**
 * Recharts reaches the dashboard only through these three, so it is code-split away from the
 * initial load. `ssr: false` matches `/plan/compare`: the charts need measured DOM width, and the
 * fixed-height placeholder reserves the same space so nothing shifts when they arrive.
 */
const DashboardCountryChart = dynamic(
  () => import('@/components/dashboard/DashboardCountryChart').then((m) => m.DashboardCountryChart),
  { ssr: false, loading: () => <DashboardChartPlaceholder height={360} /> }
);
const DashboardCategoryChart = dynamic(
  () => import('@/components/dashboard/DashboardCategoryChart').then((m) => m.DashboardCategoryChart),
  { ssr: false, loading: () => <DashboardChartPlaceholder height={360} /> }
);
const DashboardBurnChart = dynamic(
  () => import('@/components/dashboard/DashboardBurnChart').then((m) => m.DashboardBurnChart),
  { ssr: false, loading: () => <DashboardChartPlaceholder height={400} /> }
);


interface Summary {
  totalBudget: number;
  plannedLegsTotal: number;
  fixedTotal: number;
  groupSize: number;
  totalSpent: number;
  plannedToDate: number;
  varianceToDate: number;
  projectedTotal: number;
  forecastVariance: number;
  remainingLegBudget: number;
  remaining: number;
  asOfDate: string;
  asOfSource: 'last_transaction' | 'today';
  daysElapsed: number;
  daysRemaining: number;
  totalNights: number;
  destinations: number;
  expenseCount: number;
  burnRate: {
    tripAvg: number;
    plannedAvgSoFar: number;
    sevenDayAvg: number | null;
    thirtyDayAvg: number | null;
    requiredDailyPace: number | null;
  };
  budgetHealth: 'on_track' | 'warning' | 'over_budget';
}

interface CountryComparison {
  countryId: string;
  countryName: string;
  blockIndex: number | null;
  planned: number;
  actual: number;
  plannedDays: number;
  plannedPerDay: number | null;
  actualPerDay: number | null;
  status: 'planned' | 'active' | 'completed' | null;
}

type ExpandedChart = 'country' | 'category' | 'burn' | null;

// Bento categorical order: blue, teal, amber, red, violet, then quieter tones.
const CHART_COLORS = ['#2563EB', '#12A594', '#F5A524', '#E5484D', '#8E4EC6', '#0EA5E9', '#B8C2D6', '#D97706', '#64748B', '#13254A'];

const fmtAudSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

function formatDashboardDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getCategoryLabel(categoryKey: string) {
  if (categoryKey === 'transport') return 'Transport';
  return EXPENSE_CATEGORIES.find((category) => category.value === categoryKey)?.label ?? categoryKey;
}

const SUMMARY_HELP: Record<string, StatHelp> = {
  plannedTotal: {
    summary: 'All planned itinerary leg spend, including each leg’s transport and one-off costs.',
    items: [
      { label: 'Formula', description: 'sum of planned leg totals (plus any older fixed costs)' },
      { label: 'Scope', description: 'This is the full planned trip amount shown as the top-level budget.' },
    ],
  },
  actualSpentToDate: {
    summary: 'Actual logged trip spend so far.',
    items: [
      { label: 'Included', description: 'Non-excluded expenses linked to a trip leg or dated inside the trip window.' },
      { label: 'AUD Handling', description: 'A non-AUD expense without an AUD conversion contributes zero until converted.' },
    ],
  },
  plannedSpendToDate: {
    summary: 'How much the itinerary plan says you would have spent by the dashboard cutoff date.',
    items: [
      { label: 'Formula', description: 'sum of planned daily leg costs through the latest transaction date, including intercity transport on the first day of each leg' },
      { label: 'Scope', description: 'This covers itinerary leg spend only. Fixed costs are shown separately.' },
    ],
  },
  varianceToDate: {
    summary: 'Difference between actual spend so far and planned spend so far.',
    items: [
      { label: 'Formula', description: 'actual spent to date - planned spend to date' },
      { label: 'Reading', description: 'Positive means over plan so far. Negative means under plan so far.' },
    ],
  },
  plannedPerDay: {
    summary: 'Average planned daily spend across the entire trip.',
    items: [
      { label: 'Formula', description: 'planned total / total trip nights' },
      { label: 'Scope', description: 'Includes every leg cost spread across the trip.' },
    ],
  },
  daysElapsed: {
    summary: 'Whole calendar days between the trip start date and the dashboard cutoff date.',
    items: [
      { label: 'Formula', description: 'dashboard cutoff date - trip start date' },
    ],
  },
  daysLeft: {
    summary: 'Whole calendar days from the dashboard cutoff date to the trip end date.',
    items: [
      { label: 'Formula', description: 'trip end date - dashboard cutoff date' },
    ],
  },
  plannedPerDayToDate: {
    summary: 'Average planned daily spend based on the cities visited through the dashboard cutoff date.',
    items: [
      { label: 'Formula', description: 'planned spend through cutoff / elapsed days through cutoff' },
      { label: 'Why it differs from Planned $/day', description: 'Planned $/day is the full-trip average. This metric reflects the cost mix of cities you have actually been through.' },
    ],
  },
  actualPerDay: {
    summary: 'Average actual spend per elapsed trip day through the dashboard cutoff date.',
    items: [
      { label: 'Formula', description: 'actual spent through cutoff / elapsed days through cutoff' },
    ],
  },
};

export interface DashboardInitialData {
  summary: Summary | null;
  comparison: CountryComparison[];
  cityComparison: CityComparisonRow[];
  actualCategoryTotals: Record<string, number>;
  plannedCategoryTotals: Record<string, number>;
  burnData: BurnRatePoint[];
  countryBands: CountryBand[];
  readError?: string | null;
}

/**
 * The page renders this with data already loaded on the server, so the stat cards and charts are
 * present in the first HTML rather than after the bundle has downloaded and mounted. Measured
 * before this change, the dashboard request did not even begin until 569 ms into the page load —
 * the request itself took 34 ms, so the waiting was the cost, not the query.
 *
 * The mount-time refresh is kept. It no longer gates anything being shown, but it preserves the
 * previous freshness guarantee: Next's client router caches a dynamic route's payload briefly, so
 * navigating back to the dashboard could otherwise show a slightly stale figure.
 */
export function DashboardClient({ initialData }: { initialData: DashboardInitialData }) {
  const [summary, setSummary] = useState<Summary | null>(initialData.summary);
  const [comparison, setComparison] = useState<CountryComparison[]>(initialData.comparison);
  const [cityComparison, setCityComparison] = useState<CityComparisonRow[]>(initialData.cityComparison);
  const [actualCategoryTotals, setActualCategoryTotals] = useState<Record<string, number>>(initialData.actualCategoryTotals);
  const [plannedCategoryTotals, setPlannedCategoryTotals] = useState<Record<string, number>>(initialData.plannedCategoryTotals);
  const [burnData, setBurnData] = useState<BurnRatePoint[]>(initialData.burnData);
  const [countryBands, setCountryBands] = useState<CountryBand[]>(initialData.countryBands);
  const [budgetCeiling, setBudgetCeiling] = useState(initialData.summary?.totalBudget ?? 0);
  const [loading, setLoading] = useState(!initialData.summary && !initialData.readError);
  const [readError, setReadError] = useState<string | null>(initialData.readError ?? null);
  const readSequence = useRef(0);
  const [showCountryDailySpend, setShowCountryDailySpend] = useState(false);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('actual');
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null);

  const loadDashboard = useCallback(async () => {
    const sequence = ++readSequence.current;
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Could not load dashboard (HTTP ${response.status}).`);
      if (!result) throw new Error('The server returned an unreadable dashboard response.');
      const parsed = dashboardReadSchema.safeParse(result.data);
      if (!parsed.success) {
        const fields = parsed.error.issues.slice(0, 3).map(issue => issue.path.join('.') || 'data');
        throw new Error(`The server returned invalid dashboard data: ${fields.join(', ')}.`);
      }
      if (sequence !== readSequence.current) return;
      const { summary: summaryData, plannedVsActual, burnRate } = parsed.data;
      setSummary(summaryData);
      setBudgetCeiling(summaryData.totalBudget);
      setComparison(plannedVsActual.comparison);
      setCityComparison(plannedVsActual.cityComparison);
      setActualCategoryTotals(plannedVsActual.actualCategoryTotals);
      setPlannedCategoryTotals(plannedVsActual.plannedCategoryTotals);
      setBurnData(burnRate.cumulative);
      setCountryBands(burnRate.countryBands);
      setReadError(null);
    } catch (err) {
      if (sequence === readSequence.current) {
        setReadError(err instanceof Error ? err.message : 'Could not load the dashboard. Check your connection and retry.');
      }
    } finally {
      if (sequence === readSequence.current) setLoading(false);
    }
  }, []);
  useInitialPageRefresh('/', loadDashboard, Boolean(initialData.summary) && !initialData.readError);

  // These derivations previously ran unmemoized on every render, so toggling
  // showCountryDailySpend, categoryMode or expandedChart re-mapped and re-sorted the whole
  // category list, country list and burn series. They sit above the loading early-return
  // because hooks cannot be called after a conditional return.
  const selectedCategoryTotals = categoryMode === 'planned' ? plannedCategoryTotals : actualCategoryTotals;
  const totalCategorySpend = useMemo(
    () => Object.values(selectedCategoryTotals).reduce((sum, value) => sum + value, 0),
    [selectedCategoryTotals]
  );

  const categoryChartData = useMemo(
    () =>
      Object.entries(selectedCategoryTotals)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: getCategoryLabel(key),
          value: Math.round(value),
          fill: CHART_COLORS[0],
          percent: totalCategorySpend > 0 ? (value / totalCategorySpend) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({
          ...entry,
          fill: CHART_COLORS[index % CHART_COLORS.length],
          percentLabel: `${entry.percent.toFixed(0)}%`,
        })),
    [selectedCategoryTotals, totalCategorySpend]
  );

  const barData = useMemo(
    () =>
      comparison
        .filter((c) => c.planned > 0 || c.actual > 0)
        .map((c) => ({
          name: c.countryName,
          Planned: Math.round(showCountryDailySpend ? (c.plannedPerDay ?? 0) : c.planned),
          Actual: Math.round(showCountryDailySpend ? (c.actualPerDay ?? 0) : c.actual),
        })),
    [comparison, showCountryDailySpend]
  );

  const chartBurnData = useMemo(() => {
    const firstPlannedIndex = burnData.findIndex((point) => point.legStatus === 'planned');
    const lastActualIndex = burnData.reduce(
      (lastIndex, point, index) => (point.daily > 0 ? index : lastIndex),
      -1
    );

    return burnData.map((point, index) => ({
      ...point,
      spentActual:
        lastActualIndex !== -1 && (firstPlannedIndex === -1 || index < firstPlannedIndex) && index <= lastActualIndex
          ? point.cumulative
          : null,
      spentPlannedTail:
        firstPlannedIndex !== -1 && lastActualIndex >= firstPlannedIndex && index >= firstPlannedIndex && index <= lastActualIndex
          ? point.cumulative
          : null,
    }));
  }, [burnData]);

  // A new array here re-ran BurnCountryHeaderStrip's useLayoutEffect on every render, which
  // calls getBoundingClientRect per band and forces a synchronous layout during commit.
  const staggeredCountryBands = useMemo(
    () => buildStaggeredCountryBands(countryBands, chartBurnData.length),
    [countryBands, chartBurnData.length]
  );

  const cumulativeSeriesMax = useMemo(() => {
    const maxEstimatedTotal = chartBurnData.reduce(
      (maxValue, point) => Math.max(maxValue, point.plannedCumulative),
      0
    );
    const maxSpentTotal = chartBurnData.reduce(
      (maxValue, point) => Math.max(maxValue, point.cumulative),
      0
    );
    return Math.max(maxEstimatedTotal, maxSpentTotal);
  }, [chartBurnData]);

  const tripPosition = useMemo(
    () => deriveTripPosition(burnData, summary?.asOfDate),
    [burnData, summary?.asOfDate]
  );
  // The burn series names cities but not ids; the city rows carry the stored photo for each stay.
  const imageFor = (leg: { cityName: string; countryName: string | null } | null) =>
    leg ? cityComparison.find((row) => row.cityName === leg.cityName && row.countryName === leg.countryName)?.cityImage ?? null : null;

  if (loading && !summary && !readError) {
    return (
      <PageLoadingState
        title="Loading dashboard"
        description="Calculating planned versus actual spend, country totals, and burn-rate trends."
        cardCount={4}
        rowCount={4}
      />
    );
  }

  const asOfLabel = summary
    ? `${summary.asOfSource === 'last_transaction' ? 'Last transaction' : 'Today'} · ${formatDashboardDate(summary.asOfDate)}`
    : '';
  const tripLength = summary ? summary.daysElapsed + summary.daysRemaining : 0;
  const tripDateRange = burnData.length > 0
    ? `${formatDashboardDate(burnData[0].date)} – ${formatDashboardDate(burnData[burnData.length - 1].date)}`
    : null;
  const variancePercent = summary && summary.plannedToDate > 0
    ? Math.abs(summary.varianceToDate / summary.plannedToDate) * 100
    : null;
  const varianceSubtext = !summary
    ? ''
    : summary.varianceToDate === 0
      ? 'Exactly on plan so far'
      : `${summary.varianceToDate > 0 ? 'Over' : 'Under'} plan${variancePercent != null ? ` by ${variancePercent.toFixed(1)}%` : ''} so far`;
  const chartYAxisMax = Math.max(
    cumulativeSeriesMax,
    budgetCeiling,
  );

  const countryChartTitle = 'Planned vs Actual by Country';
  const categoryChartTitle = 'Spending by Category';
  const burnChartTitle = 'Cumulative Spend Over Time';
  const countryViewLabel = showCountryDailySpend ? 'Showing Per Day' : 'Showing Totals';
  const categoryViewLabel = categoryMode === 'planned' ? 'Showing Planned' : 'Showing Actual';
  const pickerTriggerClassName = 'px-3 text-xs data-[active]:bg-primary data-[active]:text-primary-foreground';
  const expandedPlotShellClassName = 'min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-2 pb-2 pt-1 shadow-sm';
  const inlineCountryChartHeight = 360;
  const expandedCountryChartHeight = 620;
  const inlineCategoryChartHeight = 360;
  const expandedCategoryChartHeight = 620;
  const expandedBurnChartHeight = 680;
  const expandedCountryBarSize = Math.min(
    24,
    Math.max(18, Math.floor(((expandedCountryChartHeight - 72) / Math.max(barData.length, 1)) * 0.78))
  );
  const expandedCategoryBarSize = Math.min(
    60,
    Math.max(34, Math.floor(((expandedCategoryChartHeight - 52) / Math.max(categoryChartData.length, 1)) * 0.68))
  );
  const burnLegendItems = getBurnRateLegendItems(
    budgetCeiling > 0,
    chartBurnData.some((point) => point.spentPlannedTail != null)
  );
  const expandedChartControls = expandedChart === 'country' ? (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={showCountryDailySpend ? 'daily' : 'total'}
        onValueChange={(value) => setShowCountryDailySpend(value === 'daily')}
        className="gap-0"
      >
        <TabsList className="h-9">
          <TabsTrigger value="total" className={pickerTriggerClassName}>Totals</TabsTrigger>
          <TabsTrigger value="daily" className={pickerTriggerClassName}>Per Day</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  ) : expandedChart === 'category' ? (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={categoryMode}
        onValueChange={(value) => setCategoryMode(value as CategoryMode)}
        className="gap-0"
      >
        <TabsList className="h-9">
          <TabsTrigger value="actual" className={pickerTriggerClassName}>Actual</TabsTrigger>
          <TabsTrigger value="planned" className={pickerTriggerClassName}>Planned</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  ) : expandedChart === 'burn' ? (
    <ExpandedChartLegend items={burnLegendItems} className="justify-end" />
  ) : null;

  const expandedChartTitle =
    expandedChart === 'country'
      ? countryChartTitle
      : expandedChart === 'category'
        ? categoryChartTitle
        : expandedChart === 'burn'
          ? burnChartTitle
          : '';
  const expandedDialogClassName =
    expandedChart === 'burn'
      ? 'grid h-[90vh] max-h-[90vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[92vw] xl:max-w-[1500px]'
      : 'grid h-[80vh] max-h-[80vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[92vw] xl:max-w-[1380px]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how your trip is tracking.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {summary ? (
            <Link
              href="/settings"
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-semibold hover:bg-accent"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              {summary.groupSize} {summary.groupSize === 1 ? 'traveller' : 'travellers'}
            </Link>
          ) : null}
          {tripDateRange ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {tripDateRange}
            </span>
          ) : null}
        </div>
      </div>

      {readError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm text-destructive">
          <div>
            <p>{readError}</p>
            <p>{summary ? 'Showing the last loaded dashboard figures; they may be out of date.' : 'Dashboard unavailable. Totals and charts could not be loaded.'}</p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void loadDashboard()}>
            <LoadingButtonLabel idle="Retry dashboard" loading="Retrying..." isLoading={loading} />
          </Button>
        </div>
      ) : null}
      {summary && summary.destinations === 0 && summary.expenseCount === 0 ? (
        <p className="text-sm text-muted-foreground">No itinerary or trip expenses yet. Add a destination or record an expense to start.</p>
      ) : null}

      {summary && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <BentoStat
            label="Planned total"
            help={SUMMARY_HELP.plannedTotal}
            value={fmtAud(summary.totalBudget)}
            subtext={summary.fixedTotal > 0 ? `Legs ${fmtAud(summary.plannedLegsTotal)} + older fixed costs ${fmtAud(summary.fixedTotal)}` : `${summary.destinations} destinations · ${summary.totalNights} nights`}
            icon={<TrendingUp />}
          />
          <BentoStat
            label="Actual spent to date"
            help={SUMMARY_HELP.actualSpentToDate}
            value={fmtAud(summary.totalSpent)}
            subtext={`${summary.expenseCount} trip expenses logged · ${asOfLabel}`}
            icon={<Receipt />}
          />
          <BentoStat
            label="Planned spend to date"
            help={SUMMARY_HELP.plannedSpendToDate}
            value={fmtAud(summary.plannedToDate)}
            subtext={`Through ${formatDashboardDate(summary.asOfDate)}`}
            icon={<CalendarDays />}
          />
          <BentoStat
            label="Variance to date"
            help={SUMMARY_HELP.varianceToDate}
            value={fmtAudSigned(summary.varianceToDate)}
            tone={summary.varianceToDate > 0 ? 'warn' : summary.varianceToDate < 0 ? 'good' : 'default'}
            icon={summary.varianceToDate > 0 ? <TrendingUp /> : <TrendingDown />}
            subtext={varianceSubtext}
          />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
          <BentoMiniStat
            label="Planned daily spend"
            help={SUMMARY_HELP.plannedPerDay}
            value={summary.totalNights > 0 ? fmtAud(summary.totalBudget / summary.totalNights) : '—'}
            unit={summary.totalNights > 0 ? '/ day' : undefined}
            subtext={`across ${summary.totalNights} nights`}
          />
          <BentoMiniStat
            label="Planned, to date"
            help={SUMMARY_HELP.plannedPerDayToDate}
            value={summary.daysElapsed > 0 ? fmtAud(summary.plannedToDate / summary.daysElapsed) : '—'}
            unit={summary.daysElapsed > 0 ? '/ day' : undefined}
            subtext={`over ${summary.daysElapsed} days elapsed`}
          />
          <BentoMiniStat
            label="Actual daily spend"
            help={SUMMARY_HELP.actualPerDay}
            value={fmtAud(summary.burnRate.tripAvg)}
            unit="/ day"
            subtext={`over ${summary.daysElapsed} days elapsed`}
          />
          <BentoMiniStat
            label="Days elapsed"
            help={SUMMARY_HELP.daysElapsed}
            value={String(summary.daysElapsed)}
            progress={tripLength > 0 ? (summary.daysElapsed / tripLength) * 100 : null}
            subtext={tripLength > 0 ? `${Math.round((summary.daysElapsed / tripLength) * 100)}% of trip` : undefined}
          />
          <BentoMiniStat
            label="Days remaining"
            help={SUMMARY_HELP.daysLeft}
            value={String(summary.daysRemaining)}
            progress={tripLength > 0 ? (summary.daysRemaining / tripLength) * 100 : null}
            progressClassName="bg-brand-teal"
            subtext={asOfLabel}
          />
        </div>
      )}

      {/* Current and next destination share one width; trip progress takes the narrower third. */}
      {summary && burnData.length > 0 && (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(240px,0.75fr)]">
          <CurrentDestinationCard position={tripPosition} image={imageFor(tripPosition.current)} />
          <UpNextCard leg={tripPosition.next} isFirst={!tripPosition.current && summary.daysElapsed <= 0} image={imageFor(tripPosition.next)} />
          <TripProgressCard spent={summary.totalSpent} budget={summary.totalBudget} />
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm">{countryChartTitle}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs
                    value={showCountryDailySpend ? 'daily' : 'total'}
                    onValueChange={(value) => setShowCountryDailySpend(value === 'daily')}
                    className="gap-0"
                    aria-label={`Country chart view, ${countryViewLabel.toLowerCase()}`}
                  >
                    <TabsList className="h-9">
                      <TabsTrigger value="total" className={pickerTriggerClassName}>Totals</TabsTrigger>
                      <TabsTrigger value="daily" className={pickerTriggerClassName}>Per Day</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button type="button" variant="outline" size="sm" onClick={() => setExpandedChart('country')}>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Expand
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DashboardCountryChart
                data={barData}
                showCountryDailySpend={showCountryDailySpend}
                height={inlineCountryChartHeight}
                expandedBarSize={expandedCountryBarSize}
                plotShellClassName={expandedPlotShellClassName}
              />
            </CardContent>
          </Card>
        )}

        {categoryChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm">{categoryChartTitle}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs
                    value={categoryMode}
                    onValueChange={(value) => setCategoryMode(value as CategoryMode)}
                    className="gap-0"
                    aria-label={`Category chart view, ${categoryViewLabel.toLowerCase()}`}
                  >
                    <TabsList className="h-9">
                      <TabsTrigger value="actual" className={pickerTriggerClassName}>Actual</TabsTrigger>
                      <TabsTrigger value="planned" className={pickerTriggerClassName}>Planned</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button type="button" variant="outline" size="sm" onClick={() => setExpandedChart('category')}>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Expand
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DashboardCategoryChart
                data={categoryChartData}
                categoryMode={categoryMode}
                height={inlineCategoryChartHeight}
                expandedBarSize={expandedCategoryBarSize}
                plotShellClassName={expandedPlotShellClassName}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {burnData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm">{burnChartTitle}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpandedChart('burn')}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Expand
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DashboardBurnChart
              data={chartBurnData}
              countryBands={staggeredCountryBands}
              height={400}
              yAxisMax={chartYAxisMax}
              budgetCeiling={budgetCeiling}
              plotShellClassName={expandedPlotShellClassName}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={expandedChart !== null} onOpenChange={(open) => {
        if (!open) setExpandedChart(null);
      }}>
      <DialogContent className={expandedDialogClassName}>
          <DialogHeader className="gap-0 border-b px-5 pt-3 pb-2">
            {expandedChartControls ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
                <DialogTitle>{expandedChartTitle}</DialogTitle>
                {expandedChartControls}
              </div>
            ) : (
              <DialogTitle>{expandedChartTitle}</DialogTitle>
            )}
            <DialogDescription className="sr-only">
              A full-screen view of this dashboard chart.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden px-5 pt-1 pb-3">
            {expandedChart === 'country' ? (
              <DashboardCountryChart
                data={barData}
                showCountryDailySpend={showCountryDailySpend}
                height={expandedCountryChartHeight}
                mode="expanded"
                expandedBarSize={expandedCountryBarSize}
                plotShellClassName={expandedPlotShellClassName}
              />
            ) : null}
            {expandedChart === 'category' ? (
              <DashboardCategoryChart
                data={categoryChartData}
                categoryMode={categoryMode}
                height={expandedCategoryChartHeight}
                mode="expanded"
                expandedBarSize={expandedCategoryBarSize}
                plotShellClassName={expandedPlotShellClassName}
              />
            ) : null}
            {expandedChart === 'burn' ? (
              <DashboardBurnChart
                data={chartBurnData}
                countryBands={staggeredCountryBands}
                height={expandedBurnChartHeight}
                mode="expanded"
                yAxisMax={chartYAxisMax}
                budgetCeiling={budgetCeiling}
                plotShellClassName={expandedPlotShellClassName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {(comparison.length > 0 || cityComparison.length > 0) && (
        <ComparisonTable countries={comparison} cities={cityComparison} />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/plan', label: 'Plan Trip', icon: Map },
          { href: '/track', label: 'Expenses', icon: Receipt },
          { href: '/track/import', label: 'Import CSV', icon: TrendingUp },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-info-soft text-blue-700">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
