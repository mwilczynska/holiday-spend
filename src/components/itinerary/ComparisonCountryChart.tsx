'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Label,
} from 'recharts';
import { Maximize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PLAN_COLORS } from '@/lib/comparison-colors';
import {
  buildCountryChartRows,
  DEFAULT_COUNTRY_CHART_MODE,
  type CountryChartMode,
  type CountryChartRow,
} from '@/lib/comparison-country-chart';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

const PICKER_TRIGGER_CLASS_NAME = 'px-3 text-xs data-active:bg-foreground data-active:text-background hover:data-active:text-background data-active:shadow-none';

interface WrappedTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string;
  };
  maxWidth?: number;
  fontSize?: number;
  lineHeight?: number;
}

function formatAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
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
      ? `${truncated.slice(0, Math.max(maxCharsPerLine - 1, 1)).trimEnd()}...`
      : `${truncated}...`;
  }

  return lines;
}

function WrappedCountryTick({
  x = 0,
  y = 0,
  payload,
  maxWidth = 128,
  fontSize = 10,
  lineHeight = 11,
}: WrappedTickProps) {
  const rawValue = payload?.value ?? '';
  const lines = wrapTickLabel(rawValue, Math.max(8, Math.floor(maxWidth / 6.8)), 2);
  const resolvedX = typeof x === 'number' ? x : Number(x ?? 0);
  const resolvedY = typeof y === 'number' ? y : Number(y ?? 0);
  const startY = resolvedY - ((lines.length - 1) * lineHeight) / 2;

  return (
    <text x={resolvedX} y={startY} textAnchor="end" fill="#475569" fontSize={fontSize}>
      {lines.map((line, index) => (
        <tspan key={`${rawValue}-${index}`} x={resolvedX} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function CountryLegend({ plans, compact = false }: { plans: PlanComparisonResult[]; compact?: boolean }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground"
      style={{ fontSize: compact ? 12 : 13 }}
    >
      {plans.map((plan, index) => (
        <div key={plan.id} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5"
            style={{ width: compact ? 22 : 26, backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length] }}
          />
          <span className="font-medium">{plan.name}</span>
        </div>
      ))}
    </div>
  );
}

function renderChart(
  plans: PlanComparisonResult[],
  rows: CountryChartRow[],
  mode: CountryChartMode,
  chartMode: 'inline' | 'expanded'
) {
  const isExpanded = chartMode === 'expanded';
  const inlineCountryTickWidth = 132;
  const inlineBarSize = Math.max(4, 8 - Math.max(plans.length - 2, 0));
  const inlineBarGap = 1;
  const inlineRowHeight = (plans.length * inlineBarSize) + (Math.max(plans.length - 1, 0) * inlineBarGap) + 4;
  const inlineHeight = Math.max(360, rows.length * inlineRowHeight + 80);
  const expandedHeight = Math.max(440, rows.length * Math.max(38, plans.length * 11) + 110);
  const expandedBarSize = Math.min(
    22,
    Math.max(16, Math.floor(((expandedHeight - 80) / Math.max(rows.length * Math.max(plans.length, 1), 1)) * 0.82))
  );

  return (
    <ResponsiveContainer width="100%" height={isExpanded ? '100%' : inlineHeight}>
      <BarChart
        data={rows}
        layout="vertical"
        barCategoryGap={isExpanded ? '10%' : '2%'}
        barGap={isExpanded ? 4 : inlineBarGap}
        margin={isExpanded ? { top: 8, right: 24, left: 18, bottom: 24 } : { top: 8, right: 10, left: 6, bottom: 14 }}
      >
        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: isExpanded ? 13 : 9 }}
          tickFormatter={(value) => `$${value}`}
        >
          <Label
            value={mode === 'daily' ? 'Spend per Day (AUD)' : 'Spend (AUD)'}
            position="insideBottom"
            offset={isExpanded ? -2 : -4}
            style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 9 }}
          />
        </XAxis>
        <YAxis
          type="category"
          dataKey="countryName"
          width={isExpanded ? 180 : inlineCountryTickWidth}
          interval={0}
          padding={{ top: 0, bottom: 0 }}
          tick={isExpanded
            ? { fontSize: 13 }
            : (props: WrappedTickProps) => (
              <WrappedCountryTick
                {...props}
                maxWidth={inlineCountryTickWidth - 10}
                fontSize={9}
                lineHeight={10}
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
          formatter={(value) => mode === 'daily' ? `${formatAud(Number(value ?? 0))}/day` : formatAud(Number(value ?? 0))}
        />
        {plans.map((plan, index) => (
          <Bar
            key={plan.id}
            dataKey={`plan_${index}`}
            name={plan.name}
            fill={PLAN_COLORS[index % PLAN_COLORS.length]}
            radius={isExpanded ? [0, 6, 6, 0] : [0, 4, 4, 0]}
            barSize={isExpanded ? expandedBarSize : inlineBarSize}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComparisonCountryChart({ plans }: { plans: PlanComparisonResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<CountryChartMode>(DEFAULT_COUNTRY_CHART_MODE);

  const allRows = useMemo(() => buildCountryChartRows(plans, mode), [plans, mode]);

  if (allRows.length === 0) return null;

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader className="min-h-[112px] pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm">Planned Spend by Country</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">View</span>
                <Tabs value={mode} onValueChange={(value) => setMode(value as CountryChartMode)} className="gap-0">
                  <TabsList className="h-8">
                    <TabsTrigger value="total" className={PICKER_TRIGGER_CLASS_NAME}>Totals</TabsTrigger>
                    <TabsTrigger value="daily" className={PICKER_TRIGGER_CLASS_NAME}>Per Day</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Expand
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Inline view shows every country in the comparison and grows to fit larger trips. Expand for a roomier full-screen view.
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <CountryLegend plans={plans} compact />
          <div className="min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-2 pb-2 pt-1 shadow-sm">
            {renderChart(plans, allRows, mode, 'inline')}
          </div>
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={(open) => { if (!open) setExpanded(false); }}>
        <DialogContent className="grid h-[85vh] max-h-[85vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[92vw] xl:max-w-[1400px]">
          <DialogHeader className="gap-0 border-b px-5 pt-3 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <DialogTitle>Planned Spend by Country</DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={mode} onValueChange={(value) => setMode(value as CountryChartMode)} className="gap-0">
                  <TabsList className="h-9">
                    <TabsTrigger value="total" className={PICKER_TRIGGER_CLASS_NAME}>Totals</TabsTrigger>
                    <TabsTrigger value="daily" className={PICKER_TRIGGER_CLASS_NAME}>Per Day</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden px-5 pt-1 pb-3">
            <div className="flex h-full min-h-0 flex-col gap-2">
              <CountryLegend plans={plans} />
              <div className="min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-2 pb-2 pt-1 shadow-sm">
                {renderChart(plans, allRows, mode, 'expanded')}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
