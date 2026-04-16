'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const PLAN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

interface SeriesPoint {
  date: string;
  cumulativePlanned: number;
  dailyPlanned: number;
}

interface PlanSeries {
  id: string;
  name: string;
  series: SeriesPoint[];
}

interface ComparisonChartProps {
  plans: PlanSeries[];
}

function formatAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function formatShortDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}

export function ComparisonChart({ plans }: ComparisonChartProps) {
  if (plans.length === 0) return null;

  // Merge all plans' series into a single dataset keyed by date
  const allDates = new Set<string>();
  for (const plan of plans) {
    for (const point of plan.series) {
      allDates.add(point.date);
    }
  }

  const sortedDates = Array.from(allDates).sort();

  // Build per-plan lookup for fast merge
  const planLookups = plans.map((plan) => {
    const lookup = new Map<string, number>();
    for (const point of plan.series) {
      lookup.set(point.date, point.cumulativePlanned);
    }
    return lookup;
  });

  // Merged dataset: each row has { date, plan_0, plan_1, ... }
  const data = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (let i = 0; i < plans.length; i++) {
      const value = planLookups[i].get(date);
      row[`plan_${i}`] = value ?? null;
    }
    return row;
  });

  // Calculate Y axis max
  let yMax = 0;
  for (const plan of plans) {
    for (const point of plan.series) {
      if (point.cumulativePlanned > yMax) yMax = point.cumulativePlanned;
    }
  }
  const yAxisMax = Math.ceil(yMax / 1000) * 1000;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium mb-4">Cumulative Planned Spend</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, yAxisMax || 'auto']}
            tickFormatter={(v) => formatAud(v)}
            tick={{ fontSize: 11 }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const planIndex = parseInt(String(name).replace('plan_', ''), 10);
              const planName = plans[planIndex]?.name ?? String(name);
              return [formatAud(Number(value)), planName];
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => `Date: ${label}`}
          />
          <Legend
            formatter={(value: string) => {
              const planIndex = parseInt(value.replace('plan_', ''), 10);
              return plans[planIndex]?.name ?? value;
            }}
          />
          {plans.map((plan, index) => (
            <Line
              key={plan.id}
              type="monotone"
              dataKey={`plan_${index}`}
              name={`plan_${index}`}
              stroke={PLAN_COLORS[index % PLAN_COLORS.length]}
              strokeWidth={2.5}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
