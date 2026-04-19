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
import { PLAN_COLORS } from '@/lib/comparison-colors';
import type { PlanComparisonCategoryTotal, PlanComparisonResult } from '@/lib/plan-comparison';

interface CategoryComparisonRow {
  category: PlanComparisonCategoryTotal['category'];
  name: string;
  [key: `plan_${number}`]: number;
}

interface WrappedTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string;
  };
}

function formatAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function getCategoryLabel(category: PlanComparisonCategoryTotal['category']) {
  switch (category) {
    case 'accommodation':
      return 'Accommodation';
    case 'food':
      return 'Food';
    case 'drinks':
      return 'Drinks';
    case 'activities':
      return 'Activities';
    case 'transport':
      return 'Transport';
    case 'fixed_cost':
      return 'Fixed Costs';
    default:
      return category;
  }
}

function wrapLabel(value: string, maxCharsPerLine: number, maxLines: number) {
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

function WrappedCategoryTick({
  x = 0,
  y = 0,
  payload,
  maxWidth = 128,
  fontSize = 10,
  lineHeight = 11,
}: WrappedTickProps & { maxWidth?: number; fontSize?: number; lineHeight?: number }) {
  const rawValue = payload?.value ?? '';
  const lines = wrapLabel(rawValue, Math.max(8, Math.floor(maxWidth / 6.8)), 2);
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

function buildCategoryComparisonRows(plans: PlanComparisonResult[]) {
  const categoryOrder: PlanComparisonCategoryTotal['category'][] = [
    'accommodation',
    'food',
    'drinks',
    'activities',
    'transport',
    'fixed_cost',
  ];

  return categoryOrder
    .map((category) => {
      const row: CategoryComparisonRow = {
        category,
        name: getCategoryLabel(category),
      };

      let total = 0;
      for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
        const value = plans[planIndex].categoryTotals.find((entry) => entry.category === category)?.totalPlanned ?? 0;
        row[`plan_${planIndex}`] = value;
        total += value;
      }

      return { ...row, total };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

function CategoryPlanLegend({ plans, compact = false }: { plans: PlanComparisonResult[]; compact?: boolean }) {
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

function renderGroupedChart(
  plans: PlanComparisonResult[],
  rows: Array<CategoryComparisonRow & { total: number }>,
  chartMode: 'inline' | 'expanded'
) {
  const isExpanded = chartMode === 'expanded';
  const inlineCategoryTickWidth = 132;
  const expandedHeight = Math.max(420, rows.length * Math.max(42, plans.length * 12) + 110);
  const expandedBarSize = Math.min(
    22,
    Math.max(16, Math.floor(((expandedHeight - 84) / Math.max(rows.length * Math.max(plans.length, 1), 1)) * 0.8))
  );

  return (
    <ResponsiveContainer width="100%" height={isExpanded ? '100%' : 360}>
      <BarChart
        data={rows}
        layout="vertical"
        barCategoryGap={isExpanded ? '10%' : '8%'}
        barGap={isExpanded ? 4 : 2}
        margin={isExpanded ? { top: 8, right: 24, left: 18, bottom: 24 } : { top: 12, right: 10, left: 6, bottom: 18 }}
      >
        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: isExpanded ? 13 : 10 }}
          tickFormatter={(value) => `$${value}`}
        >
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
          width={isExpanded ? 180 : inlineCategoryTickWidth}
          interval={0}
          padding={{ top: 0, bottom: 0 }}
          tick={isExpanded
            ? { fontSize: 13 }
            : (props: WrappedTickProps) => (
              <WrappedCategoryTick
                {...props}
                maxWidth={inlineCategoryTickWidth - 10}
                fontSize={10}
                lineHeight={11}
              />
            )}
        >
          {isExpanded ? (
            <Label
              value="Category"
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
          formatter={(value) => formatAud(Number(value ?? 0))}
        />
        {plans.map((plan, index) => (
          <Bar
            key={plan.id}
            dataKey={`plan_${index}`}
            name={`plan_${index}`}
            fill={PLAN_COLORS[index % PLAN_COLORS.length]}
            radius={isExpanded ? [0, 6, 6, 0] : [0, 4, 4, 0]}
            barSize={isExpanded ? expandedBarSize : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComparisonCategoryChart({ plans }: { plans: PlanComparisonResult[] }) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => buildCategoryComparisonRows(plans), [plans]);

  if (rows.length === 0) return null;

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader className="min-h-[112px] pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm">Planned Spend by Category</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Expand
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Compare plans category by category. Expand for a roomier version of the same grouped chart.
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <CategoryPlanLegend plans={plans} compact />
          <div className="min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-2 pb-2 pt-1 shadow-sm">
            {renderGroupedChart(plans, rows, 'inline')}
          </div>
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={(open) => { if (!open) setExpanded(false); }}>
        <DialogContent className="grid h-[85vh] max-h-[85vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[92vw] xl:max-w-[1400px]">
          <DialogHeader className="gap-0 border-b px-5 pt-3 pb-2">
            <DialogTitle>Planned Spend by Category</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden px-5 pt-1 pb-3">
            <div className="flex h-full min-h-0 flex-col gap-2">
              <CategoryPlanLegend plans={plans} />
              <div className="min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-2 pb-2 pt-1 shadow-sm">
                {renderGroupedChart(plans, rows, 'expanded')}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
