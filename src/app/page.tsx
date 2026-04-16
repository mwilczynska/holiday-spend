'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InfoPopover } from '@/components/itinerary/InfoPopover';
import { PageLoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EXPENSE_CATEGORIES } from '@/types';
import Link from 'next/link';
import { Map, Maximize2, Receipt, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  Cell, LabelList, Label, CartesianGrid,
  LineChart, Line, ReferenceArea, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

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
type ChartRenderMode = 'inline' | 'expanded';
type ResponsiveChartHeight = number | '100%';

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
  segmentStartRatio: number;
  segmentEndRatio: number;
}

type ExpandedChart = 'country' | 'category' | 'burn' | null;

interface StatHelp {
  summary: string;
  items?: Array<{
    label: string;
    description: string;
  }>;
}

interface WrappedCategoryTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string;
  };
  maxWidth?: number;
  fontSize?: number;
  lineHeight?: number;
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const COUNTRY_BAND_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#cffafe'];
const COUNTRY_STATUS_BADGE: Record<'planned' | 'active' | 'completed', string> = {
  planned: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};
const BURN_COUNTRY_LABEL_TOP_OFFSET = 4;
const BURN_COUNTRY_LABEL_ROW_GAP = 4;

const fmtAud = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
const fmtAudSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

function getBurnChartMetrics(mode: ChartRenderMode) {
  return mode === 'expanded'
    ? {
        margin: { top: 2, right: 28, left: 16, bottom: 22 },
        yAxisWidth: 92,
        countryLabelFontSize: 13,
        countryLabelLineHeight: 1.3,
        countryStripPaddingBottom: 2,
        legendGap: 2,
        legendSwatchWidth: 30,
        legendFontSize: 13,
      }
    : {
        margin: { top: 12, right: 16, left: 8, bottom: 16 },
        yAxisWidth: 76,
        countryLabelFontSize: 11,
        countryLabelLineHeight: 1.15,
        countryStripPaddingBottom: 8,
        legendGap: 4,
        legendSwatchWidth: 24,
        legendFontSize: 12,
      };
}

function getCategoryLabel(categoryKey: string) {
  if (categoryKey === 'transport') return 'Transport';
  return EXPENSE_CATEGORIES.find((category) => category.value === categoryKey)?.label ?? categoryKey;
}

function wrapTickLabel(value: string, maxCharsPerLine: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || currentLine.length === 0) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  const lastIndex = maxLines - 1;
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const truncated = lines[lastIndex];
    lines[lastIndex] = truncated.length > maxCharsPerLine - 1
      ? `${truncated.slice(0, Math.max(maxCharsPerLine - 1, 1)).trimEnd()}…`
      : `${truncated}…`;
  }

  return lines;
}

function WrappedCategoryTick({
  x = 0,
  y = 0,
  payload,
  maxWidth = 116,
  fontSize = 10,
  lineHeight = 12,
}: WrappedCategoryTickProps) {
  const rawValue = payload?.value ?? '';
  const lines = wrapTickLabel(rawValue, Math.max(8, Math.floor(maxWidth / 6.6)), 2);
  const resolvedX = typeof x === 'number' ? x : Number(x ?? 0);
  const resolvedY = typeof y === 'number' ? y : Number(y ?? 0);
  const startY = resolvedY - ((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={resolvedX}
      y={startY}
      textAnchor="end"
      fill="#475569"
      fontSize={fontSize}
    >
      {lines.map((line, index) => (
        <tspan key={`${rawValue}-${index}`} x={resolvedX} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
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
  plannedPerDay: {
    summary: 'Average planned daily spend across the entire trip.',
    items: [
      { label: 'Formula', description: 'planned total / total trip nights' },
      { label: 'Scope', description: 'Includes leg costs and fixed costs spread across the trip.' },
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
  actualPerDay: {
    summary: 'Average actual spend per elapsed trip day so far.',
    items: [
      { label: 'Formula', description: 'actual spent to date / days elapsed' },
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

function BurnRateLegend({
  includeBudget,
  mode,
}: {
  includeBudget: boolean;
  mode: ChartRenderMode;
}) {
  const metrics = getBurnChartMetrics(mode);
  const items = [
    { label: 'Spent', color: '#16a34a' },
    { label: 'Estimated', color: '#0f766e' },
    ...(includeBudget ? [{ label: 'Budget', color: '#7c3aed' }] : []),
  ];

  return (
    <div
      className="flex flex-wrap items-center justify-center text-muted-foreground"
      style={{
        gap: mode === 'expanded' ? 20 : 16,
        paddingBottom: metrics.legendGap,
        fontSize: metrics.legendFontSize,
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5"
            style={{ width: metrics.legendSwatchWidth, backgroundColor: item.color }}
          />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ExpandedChartLegend({
  items,
  mode = 'expanded',
  className,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>;
  mode?: ChartRenderMode;
  className?: string;
}) {
  const fontSize = mode === 'expanded' ? 13 : 11;
  const swatchWidth = mode === 'expanded' ? 26 : 20;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground', className)}
      style={{ fontSize }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5"
            style={{
              width: swatchWidth,
              backgroundColor: item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
              height: item.dashed ? 0 : undefined,
            }}
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
    const segmentStartRatio = bandStart / totalPointCount;
    const segmentEndRatio = (bandStart + Math.max(band.pointCount, 1)) / totalPointCount;
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
      segmentStartRatio,
      segmentEndRatio,
    };
  });
}

function getCountryBandKey(band: Pick<CountryBand, 'countryName' | 'startDate' | 'endDate'>) {
  return `${band.countryName}-${band.startDate}-${band.endDate}`;
}

function BurnCountryHeaderStrip({
  bands,
  mode,
}: {
  bands: StaggeredCountryBand[];
  mode: ChartRenderMode;
}) {
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stripInnerRef = useRef<HTMLDivElement>(null);
  const metrics = getBurnChartMetrics(mode);
  const [layout, setLayout] = useState(() => ({
    rowOffsets: [] as number[],
    stripHeight: 24,
  }));

  useLayoutEffect(() => {
    if (bands.length === 0) return;

    const measure = () => {
      const maxLabelLevel = bands.reduce((maxLevel, band) => Math.max(maxLevel, band.labelLevel), 0);
      const rowHeights = Array.from({ length: maxLabelLevel + 1 }, () => 14);

      for (const band of bands) {
        const labelNode = labelRefs.current[getCountryBandKey(band)];
        if (!labelNode) continue;
        const labelHeight = labelNode.getBoundingClientRect().height;
        rowHeights[band.labelLevel] = Math.max(rowHeights[band.labelLevel] ?? 14, Math.ceil(labelHeight));
      }

      const rowOffsets: number[] = [];
      let cursor = BURN_COUNTRY_LABEL_TOP_OFFSET;

      for (let index = 0; index < rowHeights.length; index += 1) {
        rowOffsets[index] = cursor;
        cursor += rowHeights[index] + BURN_COUNTRY_LABEL_ROW_GAP;
      }

      const stripHeight = cursor;

      setLayout((currentLayout) => {
        const sameHeight = currentLayout.stripHeight === stripHeight;
        const sameOffsets =
          currentLayout.rowOffsets.length === rowOffsets.length &&
          currentLayout.rowOffsets.every((offset, index) => offset === rowOffsets[index]);

        if (sameHeight && sameOffsets) {
          return currentLayout;
        }

        return {
          rowOffsets,
          stripHeight,
        };
      });
    };

    measure();

    if (!stripInnerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(measure);
    });

    resizeObserver.observe(stripInnerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [bands, mode]);

  if (bands.length === 0) return null;

  return (
    <div
      className="pointer-events-none"
      style={{
        paddingLeft: metrics.margin.left + metrics.yAxisWidth,
        paddingRight: metrics.margin.right,
        paddingBottom: metrics.countryStripPaddingBottom,
      }}
    >
      <div ref={stripInnerRef} className="relative" style={{ height: layout.stripHeight }}>
        {bands.map((band) => {
          const left = `${band.segmentStartRatio * 100}%`;
          const width = `${Math.max((band.segmentEndRatio - band.segmentStartRatio) * 100, 2)}%`;

          return (
            <div
              key={getCountryBandKey(band)}
              className="absolute"
              style={{
                left,
                width,
                top: layout.rowOffsets[band.labelLevel] ?? BURN_COUNTRY_LABEL_TOP_OFFSET,
              }}
            >
              <div
                ref={(node) => {
                  labelRefs.current[getCountryBandKey(band)] = node;
                }}
                className="px-1 text-center font-bold text-slate-600"
                style={{
                  fontSize: metrics.countryLabelFontSize,
                  lineHeight: metrics.countryLabelLineHeight,
                }}
              >
                {band.countryName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null);

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
  const burnLegendItems = [
    { label: 'Spent', color: '#16a34a' },
    { label: 'Estimated', color: '#0f766e', dashed: true },
    ...(budgetCeiling > 0 ? [{ label: 'Budget', color: '#7c3aed', dashed: true }] : []),
  ];
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

  const renderCountryChart = (height: number, mode: ChartRenderMode = 'inline') => {
    const isExpanded = mode === 'expanded';
    const inlineCountryTickWidth = 126;
    const chartNode = (
      <ResponsiveContainer width="100%" height={(isExpanded ? '100%' : height) as ResponsiveChartHeight}>
        <BarChart
          data={barData}
          layout="vertical"
          barCategoryGap={isExpanded ? '10%' : '8%'}
          barGap={isExpanded ? 4 : 2}
          margin={isExpanded ? { top: 8, right: 24, left: 18, bottom: 24 } : { top: 12, right: 10, left: 6, bottom: 18 }}
        >
          <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: isExpanded ? 13 : 10 }} tickFormatter={(value) => `$${value}`}>
            <Label
              value={showCountryDailySpend ? 'Spend per Day (AUD)' : 'Spend (AUD)'}
              position="insideBottom"
              offset={isExpanded ? -2 : -6}
              style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 10 }}
            />
          </XAxis>
          <YAxis
            type="category"
            dataKey="name"
            width={isExpanded ? 180 : inlineCountryTickWidth}
            interval={0}
            padding={{ top: 0, bottom: 0 }}
            tick={isExpanded
              ? { fontSize: 13 }
              : (props: WrappedCategoryTickProps) => (
                <WrappedCategoryTick
                  {...props}
                  maxWidth={inlineCountryTickWidth - 10}
                  fontSize={10}
                  lineHeight={11}
                />
              )}
          >
            {isExpanded ? (
              <Label
                value="Country"
                angle={-90}
                position="insideLeft"
                style={{ fill: '#64748b', fontSize: 13, textAnchor: 'middle' }}
              />
            ) : null}
          </YAxis>
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
            contentStyle={{
              fontSize: isExpanded ? 13 : 11,
              padding: isExpanded ? '10px 12px' : '8px 10px',
              borderRadius: '10px',
              borderColor: '#cbd5e1',
            }}
            formatter={(value) => showCountryDailySpend ? `${fmtAud(Number(value))}/day` : fmtAud(Number(value))}
          />
          {!isExpanded ? (
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{
                paddingBottom: 6,
                fontSize: 11,
              }}
            />
          ) : null}
          <Bar
            dataKey="Planned"
            fill="#94a3b8"
            radius={isExpanded ? [0, 6, 6, 0] : [0, 4, 4, 0]}
            barSize={isExpanded ? expandedCountryBarSize : undefined}
          />
          <Bar
            dataKey="Actual"
            fill="#2563eb"
            radius={isExpanded ? [0, 6, 6, 0] : [0, 4, 4, 0]}
            barSize={isExpanded ? expandedCountryBarSize : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    );

    if (!isExpanded) {
      return chartNode;
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <ExpandedChartLegend
          items={[
            { label: 'Actual', color: '#2563eb' },
            { label: 'Planned', color: '#94a3b8' },
          ]}
        />
        <div className={expandedPlotShellClassName}>{chartNode}</div>
      </div>
    );
  };

  const renderCategoryChart = (height: number, mode: ChartRenderMode = 'inline') => {
    const isExpanded = mode === 'expanded';
    const chartNode = (
      <ResponsiveContainer width="100%" height={(isExpanded ? '100%' : height) as ResponsiveChartHeight}>
        <BarChart
          data={categoryChartData}
          layout="vertical"
          barCategoryGap={isExpanded ? '2%' : '20%'}
          margin={isExpanded ? { top: 8, right: 88, left: 22, bottom: 24 } : { top: 12, right: 56, left: 12, bottom: 18 }}
        >
          <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: isExpanded ? 13 : 10 }} tickFormatter={(value) => `$${value}`}>
            <Label
              value="Spend (AUD)"
              position="insideBottom"
              offset={isExpanded ? -2 : -6}
              style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 10 }}
            />
          </XAxis>
          <YAxis
            type="category"
            dataKey="name"
            width={isExpanded ? 180 : 110}
            padding={{ top: 0, bottom: 0 }}
            tick={{ fontSize: isExpanded ? 13 : 10 }}
          >
            <Label
              value="Category"
              angle={-90}
              position="insideLeft"
              style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 10, textAnchor: 'middle' }}
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              fontSize: isExpanded ? 13 : 11,
              padding: isExpanded ? '10px 12px' : '8px 10px',
              borderRadius: '10px',
              borderColor: '#cbd5e1',
            }}
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
          <Bar dataKey="value" radius={isExpanded ? [0, 7, 7, 0] : [0, 5, 5, 0]} barSize={isExpanded ? expandedCategoryBarSize : 20}>
            {categoryChartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
            <LabelList dataKey="percentLabel" position="right" fill="#64748b" fontSize={isExpanded ? 13 : 10} offset={isExpanded ? 12 : 8} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );

    if (!isExpanded) {
      return chartNode;
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className={expandedPlotShellClassName}>{chartNode}</div>
      </div>
    );
  };

  const renderBurnChart = (height: number, mode: ChartRenderMode = 'inline') => {
    const isExpanded = mode === 'expanded';
    const burnMetrics = getBurnChartMetrics(mode);
    const chartNode = (
      <ResponsiveContainer width="100%" height={(isExpanded ? '100%' : height) as ResponsiveChartHeight}>
        <LineChart data={chartBurnData} margin={burnMetrics.margin}>
          <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: isExpanded ? 12 : 10 }} minTickGap={isExpanded ? 18 : 24}>
            <Label
              value="Date"
              position="insideBottom"
              offset={isExpanded ? 2 : -4}
              style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 11 }}
            />
          </XAxis>
          <YAxis
            width={burnMetrics.yAxisWidth}
            tick={{ fontSize: isExpanded ? 13 : 11 }}
            tickFormatter={(v) => `$${v}`}
            domain={[0, Math.max(0, Math.ceil(chartYAxisMax))]}
          >
            <Label
              value="Cumulative Spend (AUD)"
              angle={-90}
              position="insideLeft"
              style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 11, textAnchor: 'middle' }}
            />
          </YAxis>
          <Tooltip content={<BurnRateTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.4 }} />
          {!isExpanded ? <Legend content={<BurnRateLegend includeBudget={budgetCeiling > 0} mode={mode} />} /> : null}
          {staggeredCountryBands.map((band, index) => (
            <ReferenceArea
              key={getCountryBandKey(band)}
              x1={band.startDate}
              x2={band.endDate}
              fill={COUNTRY_BAND_COLORS[index % COUNTRY_BAND_COLORS.length]}
              fillOpacity={0.18}
              ifOverflow="extendDomain"
            />
          ))}
          <Line type="monotone" dataKey="spentActual" name="Spent" stroke="#16a34a" strokeWidth={isExpanded ? 3 : 2.25} strokeLinecap="round" activeDot={{ r: isExpanded ? 5 : 4 }} dot={false} />
          <Line type="monotone" dataKey="spentPlannedTail" name="Spent (planned dates)" stroke="#9ca3af" strokeWidth={isExpanded ? 3 : 2.25} strokeLinecap="round" activeDot={{ r: isExpanded ? 5 : 4 }} dot={false} legendType="none" />
          <Line type="monotone" dataKey="plannedCumulative" name="Estimated" stroke="#0f766e" strokeWidth={isExpanded ? 3 : 2.25} strokeLinecap="round" strokeDasharray={isExpanded ? '7 5' : '6 4'} activeDot={{ r: isExpanded ? 5 : 4 }} dot={false} />
          {budgetCeiling > 0 && (
            <ReferenceLine
              y={budgetCeiling}
              stroke="#7c3aed"
              strokeWidth={isExpanded ? 2.5 : 2}
              strokeDasharray="5 5"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );

    if (!isExpanded) {
      return (
        <div className="space-y-1">
          <BurnCountryHeaderStrip bands={staggeredCountryBands} mode={mode} />
          {chartNode}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <BurnCountryHeaderStrip bands={staggeredCountryBands} mode={mode} />
        <div className={expandedPlotShellClassName}>{chartNode}</div>
      </div>
    );
  };

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
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryStatCard
            label="Planned $/day"
            help={SUMMARY_HELP.plannedPerDay}
            value={summary.totalNights > 0 ? `${fmtAud(summary.totalBudget / summary.totalNights)}/day` : '—'}
            subtext={`${summary.totalNights} nights planned`}
          />
          <SummaryStatCard
            label="Actual $/day"
            help={SUMMARY_HELP.actualPerDay}
            value={`${fmtAud(summary.burnRate.tripAvg)}/day`}
            subtext={`Over ${summary.daysElapsed} days elapsed`}
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
            <CardContent>{renderCountryChart(inlineCountryChartHeight, 'inline')}</CardContent>
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
            <CardContent>{renderCategoryChart(inlineCategoryChartHeight, 'inline')}</CardContent>
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
          <CardContent>{renderBurnChart(400, 'inline')}</CardContent>
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
          </DialogHeader>
          <div className="min-h-0 overflow-hidden px-5 pt-1 pb-3">
            {expandedChart === 'country' ? renderCountryChart(expandedCountryChartHeight, 'expanded') : null}
            {expandedChart === 'category' ? renderCategoryChart(expandedCategoryChartHeight, 'expanded') : null}
            {expandedChart === 'burn' ? renderBurnChart(expandedBurnChartHeight, 'expanded') : null}
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
