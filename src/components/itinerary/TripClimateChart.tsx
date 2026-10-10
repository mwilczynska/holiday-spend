'use client';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MONTH_NAMES, type TemperatureUnit, type TripClimateSeriesPoint, type TripClimateStay } from '@/lib/climate';

const TEMP = '#D97706';
const RANGE = '#F5A524';
const RAIN = '#2563EB';

/** First-of-month ticks across the trip, thinned so at most about ten labels show. */
function monthTicks(start: number, end: number) {
  const ticks: number[] = [];
  const cursor = new Date(start);
  let t = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
  while (t <= end) {
    ticks.push(t);
    const d = new Date(t);
    t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  const step = Math.max(1, Math.ceil(ticks.length / 10));
  return ticks.filter((_, index) => index % step === 0);
}

function tickLabel(t: number) {
  const d = new Date(t);
  return `${MONTH_NAMES[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}

function ClimateTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: TripClimateSeriesPoint }>; unit: TemperatureUnit }) {
  const point = payload?.[0]?.payload;
  if (!active || !point || !point.cityName) return null;
  const day = new Date(point.t).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-bold">{point.cityName}</p>
      <p className="text-muted-foreground">{point.isEnd ? `Departure · ${day}` : day} · {point.monthLabel?.split(' ')[0]} 2021–2025 average</p>
      {point.temperature != null ? (
        <p className="mt-1">
          <span className="font-semibold" style={{ color: TEMP }}>{point.temperature.toFixed(1)}°{unit}</span> mean
          {point.range ? <span className="text-muted-foreground"> · {point.range[0].toFixed(0)}–{point.range[1].toFixed(0)}°{unit} daily</span> : null}
        </p>
      ) : <p className="mt-1 text-muted-foreground">Climate unavailable</p>}
      {point.rainfall != null ? <p><span className="font-semibold" style={{ color: RAIN }}>{point.rainfall.toFixed(0)} mm</span> monthly rain</p> : null}
    </div>
  );
}

/**
 * Date-scaled trip climate: the mean temperature steps through each stay for exactly the days
 * spent there, with the month's average daily low–high as a band and monthly rainfall as a soft
 * area on the right axis. Alternate stays are shaded so short stops remain distinguishable.
 */
export function TripClimateChart({ points, stays, unit }: { points: TripClimateSeriesPoint[]; stays: TripClimateStay[]; unit: TemperatureUnit }) {
  if (points.length === 0) return null;
  const start = points[0].t;
  const end = points[points.length - 1].t;
  const today = Date.now();
  const ticks = monthTicks(start, end);

  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: TEMP }} />Mean temperature</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: RANGE, opacity: 0.25 }} />Average daily low–high</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: RAIN, opacity: 0.18 }} />Monthly rainfall</span>
      </div>
      <div className="h-72 w-full" role="img" aria-label={`Historical mean temperature in degrees ${unit} and monthly rainfall in millimetres for each day of every dated stay`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 18 }}>
            {stays.map((stay, index) => index % 2 === 1 ? (
              <ReferenceArea key={stay.legId} x1={stay.start} x2={stay.end} yAxisId="temp" fill="#EEF2F7" fillOpacity={0.7} strokeOpacity={0} ifOverflow="hidden" />
            ) : null)}
            <CartesianGrid stroke="#E3E8EF" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[start, end]}
              ticks={ticks}
              tickFormatter={tickLabel}
              tick={{ fontSize: 11, fill: '#5A6478' }}
              tickLine={false}
              axisLine={{ stroke: '#D5DCE6' }}
              label={{ value: 'Date of stay', position: 'insideBottom', offset: -14, fontSize: 11, fill: '#5A6478' }}
            />
            <YAxis
              yAxisId="temp"
              width={58}
              tick={{ fontSize: 11, fill: '#5A6478' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={value => `${value}°`}
              domain={['auto', 'auto']}
              label={{ value: `Temperature (°${unit})`, angle: -90, position: 'insideLeft', offset: 4, fontSize: 11, fill: TEMP, style: { textAnchor: 'middle' } }}
            />
            <YAxis
              yAxisId="rain"
              orientation="right"
              width={62}
              tick={{ fontSize: 11, fill: '#5A6478' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={value => `${value}mm`}
              domain={[0, 'auto']}
              label={{ value: 'Rainfall (mm/month)', angle: 90, position: 'insideRight', offset: 4, fontSize: 11, fill: RAIN, style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<ClimateTooltip unit={unit} />} cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }} />
            <Area yAxisId="rain" type="stepAfter" dataKey="rainfall" name="Monthly rainfall" stroke={RAIN} strokeOpacity={0.45} strokeWidth={1} fill={RAIN} fillOpacity={0.12} connectNulls={false} isAnimationActive={false} activeDot={false} />
            <Area yAxisId="temp" type="stepAfter" dataKey="range" name="Average daily low–high" stroke="none" fill={RANGE} fillOpacity={0.22} connectNulls={false} isAnimationActive={false} activeDot={false} />
            <Line yAxisId="temp" type="stepAfter" dataKey="temperature" name="Mean temperature" stroke={TEMP} strokeWidth={2.25} dot={false} activeDot={{ r: 4, fill: TEMP, stroke: '#FFFFFF', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            {today > start && today < end ? (
              <ReferenceLine x={today} yAxisId="temp" stroke="#13254A" strokeDasharray="4 3" label={{ value: 'Today', position: 'insideTopLeft', fontSize: 11, fill: '#13254A' }} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
