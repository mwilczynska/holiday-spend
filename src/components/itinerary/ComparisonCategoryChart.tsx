'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Label,
  Cell,
} from 'recharts';
import { Maximize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PlanComparisonCategoryTotal, PlanComparisonResult } from '@/lib/plan-comparison';

const PLAN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
const CATEGORY_COLORS: Record<PlanComparisonCategoryTotal['category'], string> = {
  accommodation: '#2563eb',
  food: '#16a34a',
  drinks: '#f59e0b',
  activities: '#8b5cf6',
  transport: '#06b6d4',
  fixed_cost: '#64748b',
};

interface CategoryCompositionRow {
  id: string;
  name: string;
  totalPlanned: number;
  [key: string]: string | number;
}

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

function WrappedPlanTick({ x = 0, y = 0, payload }: WrappedTickProps) {
  const rawValue = payload?.value ?? '';
  const lines = wrapLabel(rawValue, 12, 2);
  const resolvedX = typeof x === 'number' ? x : Number(x ?? 0);
  const resolvedY = typeof y === 'number' ? y : Number(y ?? 0);
  const lineHeight = 11;

  return (
    <text x={resolvedX} y={resolvedY + 10} textAnchor="middle" fill="#475569" fontSize={10}>
      {lines.map((line, index) => (
        <tspan key={`${rawValue}-${index}`} x={resolvedX} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function buildCategoryCompositionRows(plans: PlanComparisonResult[]) {
  return plans.map((plan) => {
    const row: CategoryCompositionRow = {
      id: plan.id,
      name: plan.name,
      totalPlanned: plan.summary.totalBudget,
    };

    for (const category of plan.categoryTotals) {
      row[category.category] = category.totalPlanned;
    }

    return row;
  });
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

function CategoryLegend({
  items,
  type,
}: {
  items: Array<{ key: string; label: string; color: string }>;
  type: 'category' | 'plan';
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={type === 'category' ? 'inline-block h-2.5 w-2.5 rounded-full' : 'inline-block h-0.5'}
            style={type === 'category'
              ? { backgroundColor: item.color }
              : { width: 26, backgroundColor: item.color }}
          />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function renderInlineCompositionChart(plans: PlanComparisonResult[], rows: CategoryCompositionRow[]) {
  const categoryOrder: PlanComparisonCategoryTotal['category'][] = [
    'accommodation',
    'food',
    'drinks',
    'activities',
    'transport',
    'fixed_cost',
  ];

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={rows} margin={{ top: 16, right: 18, left: 6, bottom: 34 }}>
        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          interval={0}
          height={54}
          tick={(props: WrappedTickProps) => <WrappedPlanTick {...props} />}
        >
          <Label
            value="Plan"
            position="insideBottom"
            offset={-8}
            style={{ fill: '#64748b', fontSize: 10 }}
          />
        </XAxis>
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${value}`}>
          <Label
            value="Spend (AUD)"
            angle={-90}
            position="insideLeft"
            style={{ fill: '#64748b', fontSize: 10, textAnchor: 'middle' }}
          />
        </YAxis>
        <Tooltip
          contentStyle={{
            fontSize: 11,
            padding: '8px 10px',
            borderRadius: '10px',
            borderColor: '#cbd5e1',
          }}
          formatter={(value, _name, item) => {
            const rowTotal = Number(item?.payload?.totalPlanned ?? 0);
            const numericValue = Number(value ?? 0);
            const percent = rowTotal > 0 ? ` (${((numericValue / rowTotal) * 100).toFixed(0)}%)` : '';
            return `${formatAud(numericValue)}${percent}`;
          }}
          labelFormatter={(label) => `Plan: ${label}`}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: 6, fontSize: 11 }}
          formatter={(value: string) => getCategoryLabel(value as PlanComparisonCategoryTotal['category'])}
        />
        {categoryOrder.map((category) => (
          <Bar
            key={category}
            dataKey={category}
            stackId="plan-category"
            fill={CATEGORY_COLORS[category]}
            radius={category === 'fixed_cost' ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderExpandedGroupedChart(plans: PlanComparisonResult[], rows: Array<CategoryComparisonRow & { total: number }>) {
  const expandedHeight = Math.max(420, rows.length * Math.max(42, plans.length * 12) + 110);
  const expandedBarSize = Math.min(
    22,
    Math.max(16, Math.floor(((expandedHeight - 84) / Math.max(rows.length * Math.max(plans.length, 1), 1)) * 0.8))
  );

  const chartNode = (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        layout="vertical"
        barCategoryGap="10%"
        barGap={4}
        margin={{ top: 8, right: 24, left: 18, bottom: 24 }}
      >
        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 13 }} tickFormatter={(value) => `$${value}`}>
          <Label
            value="Spend (AUD)"
            position="insideBottom"
            offset={-2}
            style={{ fill: '#64748b', fontSize: 13 }}
          />
        </XAxis>
        <YAxis
          type="category"
          dataKey="name"
          width={180}
          interval={0}
          padding={{ top: 0, bottom: 0 }}
          tick={{ fontSize: 13 }}
        >
          <Label
            value="Category"
            angle={-90}
            position="insideLeft"
            style={{ fill: '#64748b', fontSize: 13, textAnchor: 'middle' }}
          />
        </YAxis>
        <Tooltip
          cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
          contentStyle={{
            fontSize: 13,
            padding: '10px 12px',
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
            radius={[0, 6, 6, 0]}
            barSize={expandedBarSize}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <CategoryLegend
        type="plan"
        items={plans.map((plan, index) => ({
          key: plan.id,
          label: plan.name,
          color: PLAN_COLORS[index % PLAN_COLORS.length],
        }))}
      />
      <div className="min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-2 pb-2 pt-1 shadow-sm">
        {chartNode}
      </div>
    </div>
  );
}

export function ComparisonCategoryChart({ plans }: { plans: PlanComparisonResult[] }) {
  const [expanded, setExpanded] = useState(false);

  const inlineRows = useMemo(() => buildCategoryCompositionRows(plans), [plans]);
  const expandedRows = useMemo(() => buildCategoryComparisonRows(plans), [plans]);
  const activeCategories = useMemo(
    () =>
      expandedRows.map((row) => ({
        key: row.category,
        label: row.name,
        color: CATEGORY_COLORS[row.category],
      })),
    [expandedRows]
  );

  if (expandedRows.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm">Planned Spend by Category</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Expand
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Inline view shows each plan as a stacked composition. Expand to compare plans category by category.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <CategoryLegend type="category" items={activeCategories} />
          {renderInlineCompositionChart(plans, inlineRows)}
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={(open) => { if (!open) setExpanded(false); }}>
        <DialogContent className="grid h-[85vh] max-h-[85vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[92vw] xl:max-w-[1400px]">
          <DialogHeader className="gap-0 border-b px-5 pt-3 pb-2">
            <DialogTitle>Planned Spend by Category</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden px-5 pt-1 pb-3">
            {renderExpandedGroupedChart(plans, expandedRows)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
