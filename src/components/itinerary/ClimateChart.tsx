'use client';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TemperatureUnit } from '@/lib/climate';

export interface ClimateChartPoint { key: string; label: string; temperature: number | null; rainfall: number | null }
export function ClimateChart({ points, unit }: { points: ClimateChartPoint[]; unit: TemperatureUnit }) {
  return <div className="h-64 w-full min-w-0" role="img" aria-label={`Historical mean temperature in degrees ${unit} and monthly rainfall in millimetres`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 15, right: 8, left: 8, bottom: 5 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="key" tickFormatter={key => points.find(point => point.key === key)?.label ?? key} tick={{ fontSize: 10 }} minTickGap={40} />
        <YAxis yAxisId="temp" width={55} tick={{ fontSize: 11 }} tickFormatter={value => `${value}°${unit}`} domain={['auto', 'auto']} />
        <YAxis yAxisId="rain" orientation="right" width={65} tick={{ fontSize: 11 }} tickFormatter={value => `${value} mm`} domain={[0, 'auto']} />
        <Tooltip labelFormatter={key => points.find(point => point.key === key)?.label ?? String(key)} formatter={(value, name) => [`${Number(value).toFixed(1)} ${name === 'Mean temperature' ? `°${unit}` : 'mm/month'}`, name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="temp" dataKey="temperature" name="Mean temperature" stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
        <Line yAxisId="rain" dataKey="rainfall" name="Monthly rainfall" stroke="#0284c7" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
