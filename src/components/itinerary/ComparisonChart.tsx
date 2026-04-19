'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Label,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

const PLAN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

interface ComparisonChartProps {
  plans: PlanComparisonResult[];
}

function formatAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function formatShortDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}

function buildChartData(plans: PlanComparisonResult[]) {
  const allDates = new Set<string>();
  for (const plan of plans) {
    for (const point of plan.series) {
      allDates.add(point.date);
    }
  }

  const sortedDates = Array.from(allDates).sort();

  const planLookups = plans.map((plan) => {
    const lookup = new Map<string, number>();
    for (const point of plan.series) {
      lookup.set(point.date, point.cumulativePlanned);
    }
    return lookup;
  });

  const data = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (let i = 0; i < plans.length; i++) {
      const value = planLookups[i].get(date);
      row[`plan_${i}`] = value ?? null;
    }
    return row;
  });

  let yMax = 0;
  for (const plan of plans) {
    for (const point of plan.series) {
      if (point.cumulativePlanned > yMax) yMax = point.cumulativePlanned;
    }
  }
  const yAxisMax = Math.ceil(yMax / 1000) * 1000;

  return { data, sortedDates, yAxisMax };
}

function computeTickInterval(totalDates: number, mode: 'inline' | 'expanded'): number {
  // Target roughly 12-16 ticks for inline, 20-25 for expanded
  const targetTicks = mode === 'expanded' ? 22 : 14;
  return Math.max(1, Math.floor(totalDates / targetTicks));
}

function getEvenlySpacedTicks(dates: string[], mode: 'inline' | 'expanded'): string[] {
  if (dates.length <= 1) return dates;
  const interval = computeTickInterval(dates.length, mode);
  const ticks: string[] = [];
  for (let i = 0; i < dates.length; i += interval) {
    ticks.push(dates[i]);
  }
  // Always include the last date
  if (ticks[ticks.length - 1] !== dates[dates.length - 1]) {
    ticks.push(dates[dates.length - 1]);
  }
  return ticks;
}

function renderChart(
  plans: PlanComparisonResult[],
  data: ReturnType<typeof buildChartData>['data'],
  sortedDates: string[],
  yAxisMax: number,
  mode: 'inline' | 'expanded',
) {
  const isExpanded = mode === 'expanded';
  const ticks = getEvenlySpacedTicks(sortedDates, mode);

  return (
    <ResponsiveContainer width="100%" height={isExpanded ? '100%' : 400}>
      <LineChart
        data={data}
        margin={isExpanded
          ? { top: 2, right: 28, left: 16, bottom: 22 }
          : { top: 12, right: 16, left: 8, bottom: 16 }
        }
      >
        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: isExpanded ? 12 : 10 }}
          ticks={ticks}
        >
          <Label
            value="Date"
            position="insideBottom"
            offset={isExpanded ? 2 : -4}
            style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 11 }}
          />
        </XAxis>
        <YAxis
          domain={[0, yAxisMax || 'auto']}
          tickFormatter={(v) => formatAud(v)}
          tick={{ fontSize: isExpanded ? 13 : 11 }}
          width={isExpanded ? 92 : 76}
        >
          <Label
            value="Cumulative Spend (AUD)"
            angle={-90}
            position="insideLeft"
            style={{ fill: '#64748b', fontSize: isExpanded ? 13 : 11, textAnchor: 'middle' }}
          />
        </YAxis>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const planIndex = parseInt(String(name).replace('plan_', ''), 10);
            const planName = plans[planIndex]?.name ?? String(name);
            return [formatAud(Number(value)), planName];
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => `Date: ${label}`}
          cursor={{ stroke: '#94a3b8', strokeOpacity: 0.4 }}
        />
        {!isExpanded && (
          <Legend
            formatter={(value: string) => {
              const planIndex = parseInt(value.replace('plan_', ''), 10);
              return plans[planIndex]?.name ?? value;
            }}
          />
        )}
        {plans.map((plan, index) => (
          <Line
            key={plan.id}
            type="monotone"
            dataKey={`plan_${index}`}
            name={`plan_${index}`}
            stroke={PLAN_COLORS[index % PLAN_COLORS.length]}
            strokeWidth={isExpanded ? 3 : 2.25}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: isExpanded ? 5 : 4 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComparisonChart({ plans }: ComparisonChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (plans.length === 0) return null;

  const { data, sortedDates, yAxisMax } = buildChartData(plans);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm">Cumulative Planned Spend</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Expand
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This line is grouped from the same canonical planned allocations as the comparison summary cards.
          </p>
        </CardHeader>
        <CardContent>
          {renderChart(plans, data, sortedDates, yAxisMax, 'inline')}
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={(open) => { if (!open) setExpanded(false); }}>
        <DialogContent className="grid h-[90vh] max-h-[90vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[92vw] xl:max-w-[1500px]">
          <DialogHeader className="gap-0 border-b px-5 pt-3 pb-2">
            <DialogTitle>Cumulative Planned Spend</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden px-5 pt-1 pb-3">
            <div className="flex h-full min-h-0 flex-col gap-2">
              {renderChart(plans, data, sortedDates, yAxisMax, 'expanded')}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
