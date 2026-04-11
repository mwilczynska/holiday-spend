'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoPopover } from '@/components/itinerary/InfoPopover';
import { PageLoadingState } from '@/components/ui/loading-state';
import { Switch } from '@/components/ui/switch';
import { EXPENSE_CATEGORIES } from '@/types';
import Link from 'next/link';
import { Map, Receipt, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  Cell, LabelList,
  LineChart, Line, ReferenceArea, ReferenceLine,
} from 'recharts';

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
  planned: number;
  actual: number;
  plannedDays: number;
  plannedPerDay: number | null;
  actualPerDay: number | null;
  status: 'planned' | 'active' | 'completed' | null;
}

type CategoryMode = 'actual' | 'planned';

interface BurnRatePoint {
  date: string;
  cumulative: number;
  daily: number;
  plannedCumulative: number;
  plannedDaily: number;
  countryName: string | null;
  cityName: string | null;
  legStatus: string | null;
}

interface CountryBand {
  countryName: string;
  startDate: string;
  endDate: string;
  pointCount: number;
}

interface StaggeredCountryBand extends CountryBand {
  labelLevel: number;
}

interface StatHelp {
  summary: string;
  items?: Array<{
    label: string;
    description: string;
  }>;
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const COUNTRY_BAND_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#cffafe'];
const COUNTRY_STATUS_BADGE: Record<'planned' | 'active' | 'completed', string> = {
  planned: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

const fmtAud = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
const fmtAudSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

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
    summary: 'How much the itinerary plan says you would have spent by today.',
    items: [
      { label: 'Formula', description: 'sum of planned daily leg costs up to today, including intercity transport on the first day of each leg' },
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
  forecastFinalSpend: {
    summary: 'Projected final actual spend by trip end if your current pace continues.',
    items: [
      { label: 'Formula', description: 'actual spent to date + forecast daily rate × days left' },
      { label: 'Forecast Rate', description: 'Uses the 7-day average if available, otherwise the trip average.' },
    ],
  },
  requiredDailyPace: {
    summary: 'Daily spending pace available from here if you want to finish within planned leg spend.',
    items: [
      { label: 'Formula', description: 'max(planned leg total - actual spent to date, 0) / days left' },
      { label: 'Scope', description: 'This pace compares actual spend to itinerary leg spend. Fixed costs are not included.' },
    ],
  },
  plannedLegs: {
    summary: 'Total planned spend across itinerary legs only.',
    items: [
      { label: 'Included', description: 'Daily leg costs plus intercity transport rows.' },
    ],
  },
  fixedCosts: {
    summary: 'Planned fixed costs tracked outside the leg-by-leg spend model.',
    items: [
      { label: 'Examples', description: 'Flights, visas, insurance, gear, and other one-off planned costs.' },
    ],
  },
  daysElapsed: {
    summary: 'Whole calendar days between the trip start date and today.',
    items: [
      { label: 'Formula', description: 'today - trip start date' },
    ],
  },
  daysLeft: {
    summary: 'Whole calendar days from today to the trip end date.',
    items: [
      { label: 'Formula', description: 'trip end date - today' },
    ],
  },
  actualAvgSoFar: {
    summary: 'Average actual spend per elapsed trip day so far.',
    items: [
      { label: 'Formula', description: 'actual spent to date / days elapsed' },
    ],
  },
  plannedAvgSoFar: {
    summary: 'Average planned leg spend per planned day that has passed so far.',
    items: [
      { label: 'Formula', description: 'planned spend to date / planned trip days elapsed' },
    ],
  },
  sevenDayAvg: {
    summary: 'Recent actual spend pace based on the last 7 calendar days.',
    items: [
      { label: 'Formula', description: 'actual spend in last 7 days / 7' },
    ],
  },
  thirtyDayAvg: {
    summary: 'Recent actual spend pace based on the last 30 calendar days.',
    items: [
      { label: 'Formula', description: 'actual spend in last 30 days / 30' },
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
        <CardTitle className="flex items-center gap-1 text-xs text-muted-foreground">
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

function BurnRateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BurnRatePoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">
        {point.cityName && point.countryName
          ? `${point.cityName}, ${point.countryName}`
          : point.countryName || 'Outside planned legs'}
      </div>
      <div className="mt-2 space-y-1">
        {[
          { label: 'Spent', color: point.legStatus === 'planned' ? '#9ca3af' : '#16a34a', value: point.cumulative },
          { label: 'Estimated', color: '#0f766e', value: point.plannedCumulative },
        ].map((entry) => (
          <div key={entry.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.label}</span>
            </div>
            <span className="font-medium">{fmtAud(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BurnRateLegend({ includeBudget }: { includeBudget: boolean }) {
  const items = [
    { label: 'Spent', color: '#16a34a' },
    { label: 'Estimated', color: '#0f766e' },
    ...(includeBudget ? [{ label: 'Budget', color: '#7c3aed' }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pb-2 text-xs text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-6"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function buildStaggeredCountryBands(bands: CountryBand[], totalPointCount: number): StaggeredCountryBand[] {
  if (bands.length === 0 || totalPointCount <= 0) return [];

  const estimatedPlotWidthPx = 760;
  const pointsPerPixel = totalPointCount > 1 ? (totalPointCount - 1) / estimatedPlotWidthPx : 1;
  const levelEndByIndex: number[] = [];
  let pointCursor = 0;

  return bands.map((band) => {
    const bandStart = pointCursor;
    const bandEnd = pointCursor + Math.max(band.pointCount - 1, 0);
    pointCursor += band.pointCount;

    const estimatedLabelWidthInPoints = Math.max(
      band.pointCount,
      Math.max(band.countryName.length * 7 * pointsPerPixel, 3)
    );
    const labelMidpoint = (bandStart + bandEnd) / 2;
    const labelStart = labelMidpoint - estimatedLabelWidthInPoints / 2;
    const labelEnd = labelMidpoint + estimatedLabelWidthInPoints / 2;

    let labelLevel = 0;
    while (levelEndByIndex[labelLevel] != null && labelStart <= levelEndByIndex[labelLevel]) {
      labelLevel += 1;
    }
    levelEndByIndex[labelLevel] = labelEnd;

    return {
      ...band,
      labelLevel,
    };
  });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [comparison, setComparison] = useState<CountryComparison[]>([]);
  const [actualCategoryTotals, setActualCategoryTotals] = useState<Record<string, number>>({});
  const [plannedCategoryTotals, setPlannedCategoryTotals] = useState<Record<string, number>>({});
  const [burnData, setBurnData] = useState<BurnRatePoint[]>([]);
  const [countryBands, setCountryBands] = useState<CountryBand[]>([]);
  const [budgetCeiling, setBudgetCeiling] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCountryDailySpend, setShowCountryDailySpend] = useState(false);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('actual');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [summaryRes, compRes, burnRes] = await Promise.all([
          fetch('/api/dashboard/summary', { cache: 'no-store' }),
          fetch('/api/dashboard/planned-vs-actual', { cache: 'no-store' }),
          fetch('/api/dashboard/burn-rate', { cache: 'no-store' }),
        ]);
        const summaryData = await summaryRes.json();
        const compData = await compRes.json();
        const burnRateData = await burnRes.json();

        if (summaryData.data) setSummary(summaryData.data);
        if (compData.data) {
          setComparison(compData.data.comparison || []);
          setActualCategoryTotals(compData.data.actualCategoryTotals || {});
          setPlannedCategoryTotals(compData.data.plannedCategoryTotals || {});
        }
        if (burnRateData.data) {
          setBurnData(burnRateData.data.cumulative || []);
          setCountryBands(burnRateData.data.countryBands || []);
        }
        if (summaryData.data) {
          setBudgetCeiling(summaryData.data.totalBudget);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  const selectedCategoryTotals = categoryMode === 'planned' ? plannedCategoryTotals : actualCategoryTotals;
  const totalCategorySpend = Object.values(selectedCategoryTotals).reduce((sum, value) => sum + value, 0);

  const categoryChartData = Object.entries(selectedCategoryTotals)
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
    }));

  const barData = comparison
    .filter((c) => c.planned > 0 || c.actual > 0)
    .map((c) => ({
      name: c.countryName,
      Planned: Math.round(showCountryDailySpend ? (c.plannedPerDay ?? 0) : c.planned),
      Actual: Math.round(showCountryDailySpend ? (c.actualPerDay ?? 0) : c.actual),
    }));

  const firstPlannedIndex = burnData.findIndex((point) => point.legStatus === 'planned');
  const lastActualIndex = burnData.reduce((lastIndex, point, index) => (
    point.daily > 0 ? index : lastIndex
  ), -1);
  const chartBurnData = burnData.map((point, index) => ({
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
  const staggeredCountryBands = buildStaggeredCountryBands(countryBands, chartBurnData.length);
  const maxCountryLabelLevel = staggeredCountryBands.reduce((maxLevel, band) => Math.max(maxLevel, band.labelLevel), 0);
  const maxEstimatedTotal = chartBurnData.reduce(
    (maxValue, point) => Math.max(maxValue, point.plannedCumulative),
    0
  );
  const maxSpentTotal = chartBurnData.reduce(
    (maxValue, point) => Math.max(maxValue, point.cumulative),
    0
  );
  const cumulativeSeriesMax = Math.max(maxEstimatedTotal, maxSpentTotal);
  const chartYAxisMax = Math.max(
    cumulativeSeriesMax * 1.3,
    budgetCeiling,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wanderledger</h1>
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
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
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
            subtext={`${summary.expenseCount} trip expenses logged`}
          />
          <SummaryStatCard
            label="Planned Spend To Date"
            help={SUMMARY_HELP.plannedSpendToDate}
            value={fmtAud(summary.plannedToDate)}
            subtext="Cumulative itinerary plan through today"
          />
          <SummaryStatCard
            label="Variance To Date"
            help={SUMMARY_HELP.varianceToDate}
            value={fmtAudSigned(summary.varianceToDate)}
            valueClassName={summary.varianceToDate > 0 ? 'text-red-600' : summary.varianceToDate < 0 ? 'text-green-600' : ''}
            subtext={summary.varianceToDate > 0 ? 'Over plan so far' : summary.varianceToDate < 0 ? 'Under plan so far' : 'Exactly on plan so far'}
          />
          <SummaryStatCard
            label="Forecast Final Spend"
            help={SUMMARY_HELP.forecastFinalSpend}
            value={fmtAud(summary.projectedTotal)}
            valueClassName={summary.forecastVariance > 0 ? 'text-red-600' : summary.forecastVariance < 0 ? 'text-green-600' : ''}
            subtext={`${fmtAudSigned(summary.forecastVariance)} vs planned legs`}
          />
          <SummaryStatCard
            label="Required Daily Pace"
            help={SUMMARY_HELP.requiredDailyPace}
            value={summary.burnRate.requiredDailyPace != null ? `${fmtAud(summary.burnRate.requiredDailyPace)}/day` : '—'}
            valueClassName={summary.remainingLegBudget < 0 ? 'text-red-600' : ''}
            subtext={summary.daysRemaining > 0 ? (summary.remainingLegBudget < 0 ? `Already over planned legs by ${fmtAud(Math.abs(summary.remainingLegBudget))}` : 'To finish within planned legs') : 'No remaining trip days'}
          />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <SummaryStatCard
            label="Planned Legs"
            help={SUMMARY_HELP.plannedLegs}
            value={fmtAud(summary.plannedLegsTotal)}
          />
          <SummaryStatCard
            label="Fixed Costs"
            help={SUMMARY_HELP.fixedCosts}
            value={fmtAud(summary.fixedTotal)}
          />
          <SummaryStatCard
            label="Days Elapsed"
            help={SUMMARY_HELP.daysElapsed}
            value={String(summary.daysElapsed)}
          />
          <SummaryStatCard
            label="Days Left"
            help={SUMMARY_HELP.daysLeft}
            value={String(summary.daysRemaining)}
          />
          <SummaryStatCard
            label="Actual Avg So Far"
            help={SUMMARY_HELP.actualAvgSoFar}
            value={`${fmtAud(summary.burnRate.tripAvg)}/day`}
          />
          <SummaryStatCard
            label="Planned Avg So Far"
            help={SUMMARY_HELP.plannedAvgSoFar}
            value={`${fmtAud(summary.burnRate.plannedAvgSoFar)}/day`}
          />
          <SummaryStatCard
            label="7-Day Avg"
            help={SUMMARY_HELP.sevenDayAvg}
            value={summary.burnRate.sevenDayAvg != null ? `${fmtAud(summary.burnRate.sevenDayAvg)}/day` : '—'}
          />
          <SummaryStatCard
            label="30-Day Avg"
            help={SUMMARY_HELP.thirtyDayAvg}
            value={summary.burnRate.thirtyDayAvg != null ? `${fmtAud(summary.burnRate.thirtyDayAvg)}/day` : '—'}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm">
                  Planned vs Actual by Country
                </CardTitle>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={showCountryDailySpend} onCheckedChange={setShowCountryDailySpend} />
                  <span>Show daily spend</span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={72}
                    angle={-45}
                    textAnchor="end"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value) => showCountryDailySpend ? `${fmtAud(Number(value))}/day` : fmtAud(Number(value))} />
                  <Legend />
                  <Bar dataKey="Planned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {categoryChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm">Spending by Category</CardTitle>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={categoryMode === 'planned'}
                    onCheckedChange={(checked) => setCategoryMode(checked ? 'planned' : 'actual')}
                  />
                  <span>{categoryMode === 'planned' ? 'Showing planned' : 'Showing actual'}</span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(250, categoryChartData.length * 40)}>
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 48, left: 16, bottom: 8 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const percent = typeof item?.payload?.percent === 'number'
                        ? ` (${item.payload.percent.toFixed(0)}%)`
                        : '';
                      return `${fmtAud(Number(value))}${percent}`;
                    }}
                    labelFormatter={(label) =>
                      `${categoryMode === 'planned' ? 'Planned' : 'Actual'}: ${label}`
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="percentLabel" position="right" fill="#64748b" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {burnData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cumulative Spend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartBurnData} margin={{ top: 36 + maxCountryLabelLevel * 14, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${v}`}
                  domain={[0, Math.max(0, Math.ceil(chartYAxisMax * (1 + maxCountryLabelLevel * 0.02)))]}
                />
                <Tooltip content={<BurnRateTooltip />} />
                <Legend content={<BurnRateLegend includeBudget={budgetCeiling > 0} />} />
                {staggeredCountryBands.map((band, index) => (
                  <ReferenceArea
                    key={`${band.countryName}-${band.startDate}-${band.endDate}`}
                    x1={band.startDate}
                    x2={band.endDate}
                    fill={COUNTRY_BAND_COLORS[index % COUNTRY_BAND_COLORS.length]}
                    fillOpacity={0.18}
                    ifOverflow="extendDomain"
                    label={band.pointCount >= 4 ? {
                      value: band.countryName,
                      position: 'insideTop',
                      fill: '#475569',
                      fontSize: 11,
                      fontWeight: 700,
                      dy: 4 + band.labelLevel * 14,
                    } : undefined}
                  />
                ))}
                <Line type="monotone" dataKey="spentActual" name="Spent" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="spentPlannedTail" name="Spent (planned dates)" stroke="#9ca3af" strokeWidth={2} dot={false} legendType="none" />
                <Line type="monotone" dataKey="plannedCumulative" name="Estimated" stroke="#0f766e" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                {budgetCeiling > 0 && (
                  <ReferenceLine
                    y={budgetCeiling}
                    stroke="#7c3aed"
                    strokeDasharray="5 5"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
                  {comparison.filter((c) => c.planned > 0 || c.actual > 0).map((c) => {
                    const diff = c.actual - c.planned;
                    const isOver = diff > 0;
                    return (
                      <tr key={c.countryId} className="border-b last:border-0">
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
