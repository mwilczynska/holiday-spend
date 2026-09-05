'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InfoPopover } from '@/components/itinerary/InfoPopover';
import { PageLoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EXPENSE_CATEGORIES } from '@/types';
import Link from 'next/link';
import { Map, Maximize2, Receipt, TrendingUp } from 'lucide-react';
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

interface StatHelp {
  summary: string;
  items?: Array<{
    label: string;
    description: string;
  }>;
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const COUNTRY_STATUS_BADGE: Record<'planned' | 'active' | 'completed', string> = {
  planned: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

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
    summary: 'All planned itinerary leg spend plus fixed costs.',
    items: [
      { label: 'Formula', description: 'planned leg totals + fixed costs' },
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
      { label: 'Scope', description: 'Includes leg costs and fixed costs spread across the trip.' },
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

function SummaryStatCard({
  label,
  help,
  value,
  subtext,
  valueClassName,
}: {
  label: string;
  help: StatHelp;
  value: string;
  subtext?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>{label}</span>
          <InfoPopover title={label} summary={help.summary} items={help.items} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-bold ${valueClassName || ''}`}>{value}</p>
        {subtext ? <p className="text-xs text-muted-foreground">{subtext}</p> : null}
      </CardContent>
    </Card>
  );
}

// Module scope, so it resets on a full document load and persists across client-side navigations.
let hasMountedInThisDocument = false;

export interface DashboardInitialData {
  summary: Summary | null;
  comparison: CountryComparison[];
  actualCategoryTotals: Record<string, number>;
  plannedCategoryTotals: Record<string, number>;
  burnData: BurnRatePoint[];
  countryBands: CountryBand[];
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
  const [actualCategoryTotals, setActualCategoryTotals] = useState<Record<string, number>>(initialData.actualCategoryTotals);
  const [plannedCategoryTotals, setPlannedCategoryTotals] = useState<Record<string, number>>(initialData.plannedCategoryTotals);
  const [burnData, setBurnData] = useState<BurnRatePoint[]>(initialData.burnData);
  const [countryBands, setCountryBands] = useState<CountryBand[]>(initialData.countryBands);
  const [budgetCeiling, setBudgetCeiling] = useState(initialData.summary?.totalBudget ?? 0);
  const [loading, setLoading] = useState(!initialData.summary);
  const [showCountryDailySpend, setShowCountryDailySpend] = useState(false);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('actual');
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null);

  const hasServerRenderedData = Boolean(initialData.summary);

  useEffect(() => {
    /**
     * On a full page load this module is freshly evaluated, so `hasMountedInThisDocument` is
     * false and the data the server just rendered is current — refetching it would send the same
     * 89 kB twice. On a later client-side navigation back to the dashboard the module is already
     * loaded, so the flag is true; Next's client router can serve a cached payload for a dynamic
     * route, so that case does refetch and the previous freshness guarantee is kept.
     */
    if (!hasMountedInThisDocument) {
      hasMountedInThisDocument = true;
      if (hasServerRenderedData) return;
    }

    async function load() {
      try {
        // One request rather than three. The three endpoints still exist and are unchanged, but
        // each re-read the same legs, cities, countries and 1,300 expense rows, so rendering this
        // page loaded them three times over.
        const response = await fetch('/api/dashboard', { cache: 'no-store' });
        const { data } = await response.json();
        if (!data) return;

        const { summary: summaryData, plannedVsActual, burnRate } = data;

        if (summaryData) {
          setSummary(summaryData);
          setBudgetCeiling(summaryData.totalBudget);
        }
        if (plannedVsActual) {
          setComparison(plannedVsActual.comparison || []);
          setActualCategoryTotals(plannedVsActual.actualCategoryTotals || {});
          setPlannedCategoryTotals(plannedVsActual.plannedCategoryTotals || {});
        }
        if (burnRate) {
          setBurnData(burnRate.cumulative || []);
          setCountryBands(burnRate.countryBands || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasServerRenderedData]);

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

  if (loading && !summary) {
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
  const burnLegendItems = getBurnRateLegendItems(budgetCeiling > 0);
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
      <Badge variant={showCountryDailySpend ? 'outline' : 'default'} className="text-[10px] uppercase tracking-wide">
        {countryViewLabel}
      </Badge>
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
      <Badge variant={categoryMode === 'planned' ? 'outline' : 'default'} className="text-[10px] uppercase tracking-wide">
        {categoryViewLabel}
      </Badge>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Holiday Spend</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Travel Budget Planner & Tracker</span>
            {summary ? (
              <Badge variant="outline">
                {summary.groupSize} {summary.groupSize === 1 ? 'traveller' : 'travellers'}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryStatCard
            label="Planned Total"
            help={SUMMARY_HELP.plannedTotal}
            value={fmtAud(summary.totalBudget)}
            subtext={`${summary.groupSize} ${summary.groupSize === 1 ? 'traveller' : 'travellers'} selected. Leg plan ${fmtAud(summary.plannedLegsTotal)} + fixed ${fmtAud(summary.fixedTotal)}`}
          />
          <SummaryStatCard
            label="Actual Spent To Date"
            help={SUMMARY_HELP.actualSpentToDate}
            value={fmtAud(summary.totalSpent)}
            subtext={`${summary.expenseCount} trip expenses logged · ${asOfLabel}`}
          />
          <SummaryStatCard
            label="Planned Spend To Date"
            help={SUMMARY_HELP.plannedSpendToDate}
            value={fmtAud(summary.plannedToDate)}
            subtext={`Cumulative itinerary plan through ${formatDashboardDate(summary.asOfDate)}`}
          />
          <SummaryStatCard
            label="Variance To Date"
            help={SUMMARY_HELP.varianceToDate}
            value={fmtAudSigned(summary.varianceToDate)}
            valueClassName={summary.varianceToDate > 0 ? 'text-red-600' : summary.varianceToDate < 0 ? 'text-green-600' : ''}
            subtext={`${summary.varianceToDate > 0 ? 'Over plan so far' : summary.varianceToDate < 0 ? 'Under plan so far' : 'Exactly on plan so far'} · ${asOfLabel}`}
          />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <SummaryStatCard
            label="Planned $/day"
            help={SUMMARY_HELP.plannedPerDay}
            value={summary.totalNights > 0 ? `${fmtAud(summary.totalBudget / summary.totalNights)}/day` : '—'}
            subtext={`${summary.totalNights} nights planned`}
          />
          <SummaryStatCard
            label="Plan $/day to Date"
            help={SUMMARY_HELP.plannedPerDayToDate}
            value={summary.daysElapsed > 0 ? `${fmtAud(summary.plannedToDate / summary.daysElapsed)}/day` : '—'}
            subtext={`Over ${summary.daysElapsed} days elapsed · ${asOfLabel}`}
          />
          <SummaryStatCard
            label="Actual $/day"
            help={SUMMARY_HELP.actualPerDay}
            value={`${fmtAud(summary.burnRate.tripAvg)}/day`}
            subtext={`Over ${summary.daysElapsed} days elapsed · ${asOfLabel}`}
          />
          <SummaryStatCard
            label="Days Elapsed"
            help={SUMMARY_HELP.daysElapsed}
            value={String(summary.daysElapsed)}
          />
          <SummaryStatCard
            label="Days Remaining at Cutoff"
            help={SUMMARY_HELP.daysLeft}
            value={String(summary.daysRemaining)}
            subtext={asOfLabel}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm">{countryChartTitle}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                    <span className="text-xs font-medium text-muted-foreground">View</span>
                    <Tabs
                      value={showCountryDailySpend ? 'daily' : 'total'}
                      onValueChange={(value) => setShowCountryDailySpend(value === 'daily')}
                      className="gap-0"
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="total" className={pickerTriggerClassName}>Totals</TabsTrigger>
                        <TabsTrigger value="daily" className={pickerTriggerClassName}>Per Day</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Badge variant={showCountryDailySpend ? 'outline' : 'default'} className="text-[10px] uppercase tracking-wide">
                      {countryViewLabel}
                    </Badge>
                  </div>
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
                  <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                    <span className="text-xs font-medium text-muted-foreground">View</span>
                    <Tabs
                      value={categoryMode}
                      onValueChange={(value) => setCategoryMode(value as CategoryMode)}
                      className="gap-0"
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="actual" className={pickerTriggerClassName}>Actual</TabsTrigger>
                        <TabsTrigger value="planned" className={pickerTriggerClassName}>Planned</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Badge variant={categoryMode === 'planned' ? 'outline' : 'default'} className="text-[10px] uppercase tracking-wide">
                      {categoryViewLabel}
                    </Badge>
                  </div>
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

      {comparison.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Country Comparison</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="p-2 text-left">Country</th>
                    <th className="p-2 text-right"># days</th>
                    <th className="p-2 text-right">Planned</th>
                    <th className="p-2 text-right">Planned $/day</th>
                    <th className="p-2 text-right">Actual</th>
                    <th className="p-2 text-right">Actual $/day</th>
                    <th className="p-2 text-right">Difference</th>
                    <th className="p-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.filter((c) => c.planned > 0 || c.actual > 0).map((c, index) => {
                    const diff = c.actual - c.planned;
                    const isOver = diff > 0;
                    return (
                      <tr key={`${c.countryId}:${c.blockIndex ?? 'actual'}:${index}`} className="border-b last:border-0">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.countryName}</span>
                            {c.status ? (
                              <Badge variant="outline" className={`text-[10px] capitalize ${COUNTRY_STATUS_BADGE[c.status]}`}>
                                {c.status}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2 text-right">{c.plannedDays}</td>
                        <td className="p-2 text-right">{fmtAud(c.planned)}</td>
                        <td className="p-2 text-right">{c.plannedPerDay != null ? fmtAud(c.plannedPerDay) : '—'}</td>
                        <td className="p-2 text-right">{fmtAud(c.actual)}</td>
                        <td className="p-2 text-right">{c.actualPerDay != null ? fmtAud(c.actualPerDay) : '—'}</td>
                        <td className={`p-2 text-right ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                          {isOver ? '+' : ''}{fmtAud(diff)}
                        </td>
                        <td className="p-2 text-right">
                          {c.planned > 0 ? (
                            <Badge variant={isOver ? 'destructive' : 'default'} className="text-xs">
                              {((c.actual / c.planned) * 100).toFixed(0)}%
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">No plan</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Link href="/plan" className="block">
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Map className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Plan Trip</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/track" className="block">
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Receipt className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Expenses</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/track/import" className="block">
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Import CSV</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
