'use client';

import { memo } from 'react';
import {
  CartesianGrid, Label, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BurnCountryHeaderStrip, BurnRateLegend, BurnRateTooltip, COUNTRY_BAND_COLORS,
  getBurnChartMetrics, getCountryBandKey,
  type BurnRatePoint, type ChartRenderMode, type ResponsiveChartHeight,
  type StaggeredCountryBand,
} from '@/components/dashboard/dashboard-chart-parts';

export type BurnChartDatum = BurnRatePoint & {
  spentActual: number | null;
  spentPlannedTail: number | null;
};

/**
 * Split out of `src/app/page.tsx` and loaded with `next/dynamic` so Recharts stays off the
 * dashboard's initial bundle. `React.memo` is the second reason: the three charts previously
 * re-rendered together whenever an unrelated piece of dashboard state changed.
 */
export const DashboardBurnChart = memo(function DashboardBurnChart({
  data,
  countryBands,
  height,
  mode = 'inline',
  yAxisMax,
  budgetCeiling,
  plotShellClassName,
}: {
  data: BurnChartDatum[];
  countryBands: StaggeredCountryBand[];
  height: number;
  mode?: ChartRenderMode;
  yAxisMax: number;
  budgetCeiling: number;
  plotShellClassName: string;
}) {
    const isExpanded = mode === 'expanded';
    const burnMetrics = getBurnChartMetrics(mode);
    const chartNode = (
      <ResponsiveContainer width="100%" height={(isExpanded ? '100%' : height) as ResponsiveChartHeight}>
        <LineChart data={data} margin={burnMetrics.margin}>
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
            domain={[0, Math.max(0, Math.ceil(yAxisMax))]}
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
          {countryBands.map((band, index) => (
            <ReferenceArea
              key={getCountryBandKey(band)}
              x1={band.startDate}
              x2={band.endDate}
              fill={COUNTRY_BAND_COLORS[index % COUNTRY_BAND_COLORS.length]}
              fillOpacity={0.18}
              ifOverflow="extendDomain"
            />
          ))}
          <Line type="monotone" dataKey="spentActual" name="Actual spend" stroke="#16a34a" strokeWidth={isExpanded ? 3 : 2.25} strokeLinecap="round" activeDot={{ r: isExpanded ? 5 : 4 }} dot={false} />
          <Line type="monotone" dataKey="spentPlannedTail" name="Actual spend · leg still planned" stroke="#9ca3af" strokeWidth={isExpanded ? 3 : 2.25} strokeLinecap="round" activeDot={{ r: isExpanded ? 5 : 4 }} dot={false} legendType="none" />
          <Line type="monotone" dataKey="plannedCumulative" name="Planned estimate" stroke="#0f766e" strokeWidth={isExpanded ? 3 : 2.25} strokeLinecap="round" strokeDasharray={isExpanded ? '7 5' : '6 4'} activeDot={{ r: isExpanded ? 5 : 4 }} dot={false} />
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
          <BurnCountryHeaderStrip bands={countryBands} mode={mode} />
          {chartNode}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <BurnCountryHeaderStrip bands={countryBands} mode={mode} />
        <div className={plotShellClassName}>{chartNode}</div>
      </div>
    );
});
