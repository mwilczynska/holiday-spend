'use client';

import { memo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Label, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  fmtAud,
  type CategoryMode, type ChartRenderMode, type ResponsiveChartHeight,
} from '@/components/dashboard/dashboard-chart-parts';

export interface CategoryChartDatum {
  name: string;
  value: number;
  fill: string;
  percent: number;
  percentLabel: string;
}

/**
 * Split out of `src/app/page.tsx` and loaded with `next/dynamic` so Recharts stays off the
 * dashboard's initial bundle. `React.memo` is the second reason: the three charts previously
 * re-rendered together whenever an unrelated piece of dashboard state changed.
 */
export const DashboardCategoryChart = memo(function DashboardCategoryChart({
  data,
  categoryMode,
  height,
  mode = 'inline',
  expandedBarSize,
  plotShellClassName,
}: {
  data: CategoryChartDatum[];
  categoryMode: CategoryMode;
  height: number;
  mode?: ChartRenderMode;
  expandedBarSize: number;
  plotShellClassName: string;
}) {
    const isExpanded = mode === 'expanded';
    const chartNode = (
      <ResponsiveContainer width="100%" height={(isExpanded ? '100%' : height) as ResponsiveChartHeight}>
        <BarChart
          data={data}
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
          <Bar dataKey="value" radius={isExpanded ? [0, 7, 7, 0] : [0, 5, 5, 0]} barSize={isExpanded ? expandedBarSize : 20}>
            {data.map((entry) => (
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
        <div className={plotShellClassName}>{chartNode}</div>
      </div>
    );
});
