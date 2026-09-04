'use client';

import { memo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Label, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ExpandedChartLegend, WrappedCategoryTick, fmtAud,
  type ChartRenderMode, type ResponsiveChartHeight, type WrappedCategoryTickProps,
} from '@/components/dashboard/dashboard-chart-parts';

export interface CountryChartDatum {
  name: string;
  Planned: number;
  Actual: number;
}

/**
 * Split out of `src/app/page.tsx` and loaded with `next/dynamic` so Recharts stays off the
 * dashboard's initial bundle. `React.memo` is the second reason: the three charts previously
 * re-rendered together whenever an unrelated piece of dashboard state changed.
 */
export const DashboardCountryChart = memo(function DashboardCountryChart({
  data,
  showCountryDailySpend,
  height,
  mode = 'inline',
  expandedBarSize,
  plotShellClassName,
}: {
  data: CountryChartDatum[];
  showCountryDailySpend: boolean;
  height: number;
  mode?: ChartRenderMode;
  expandedBarSize: number;
  plotShellClassName: string;
}) {
    const isExpanded = mode === 'expanded';
    const inlineCountryTickWidth = 126;
    const chartNode = (
      <ResponsiveContainer width="100%" height={(isExpanded ? '100%' : height) as ResponsiveChartHeight}>
        <BarChart
          data={data}
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
            barSize={isExpanded ? expandedBarSize : undefined}
          />
          <Bar
            dataKey="Actual"
            fill="#2563eb"
            radius={isExpanded ? [0, 6, 6, 0] : [0, 4, 4, 0]}
            barSize={isExpanded ? expandedBarSize : undefined}
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
        <div className={plotShellClassName}>{chartNode}</div>
      </div>
    );
});
