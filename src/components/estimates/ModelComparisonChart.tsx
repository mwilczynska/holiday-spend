'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import comparison from '@/lib/data/model-comparison-v1-2.json';
import { cn } from '@/lib/utils';

// Models down the side, one measure along the bottom (accuracy, cost per city or time per city), each with its range:
// a 95% paired interval for accuracy, the 10th to 90th percentile of cities for cost and time. Data comes from the
// city-cost research branch (export-model-comparison.mjs) and is fixed per release of the comparison.

type Row = (typeof comparison.rows)[number];
type Metric = 'accuracy' | 'cost' | 'time';
type Family = 'haiku' | 'sonnet' | 'opus' | 'gpt';

const FAMILIES: Array<{ key: Family; label: string }> = [
  { key: 'haiku', label: 'Claude Haiku 5.5' },
  { key: 'sonnet', label: 'Claude Sonnet 5.5' },
  { key: 'opus', label: 'Claude Opus 5.5' },
  { key: 'gpt', label: 'OpenAI GPT-6.x' },
];
const familyColor = (family: string) => `hsl(var(--model-${family}))`;

const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(3)}`;
const usd = (value: number) => `US$${value.toFixed(value < 0.1 ? 3 : 2)}`;
const minutes = (value: number) => (value < 1 ? `${Math.round(value * 60)} s` : `${value.toFixed(1)} min`);

const METRICS: Record<Metric, {
  label: string;
  title: string;
  note: string;
  scale: 'linear' | 'log';
  domain: [number, number];
  ticks: number[];
  value: (row: Row) => number;
  low: (row: Row) => number;
  high: (row: Row) => number;
  format: (value: number) => string;
  tick: (value: number) => string;
  reference: number;
  left: string;
  right: string;
}> = {
  accuracy: {
    label: 'Accuracy',
    title: 'Error compared with GPT-6 Luna',
    note: 'Difference in budget-weighted error per city from GPT-6 Luna on the same reference cities, each model with the app’s correction for that model. Bars are 95% intervals; a bar crossing the dashed line is within noise.',
    scale: 'linear', domain: [-0.06, 0.1], ticks: [-0.04, -0.02, 0, 0.02, 0.04, 0.06, 0.08, 0.1],
    value: (row) => row.diff, low: (row) => row.diffLow, high: (row) => row.diffHigh,
    format: signed, tick: (value) => (value === 0 ? '0' : signed(value)), reference: 0,
    left: '← more accurate', right: 'less accurate →',
  },
  cost: {
    label: 'Cost per city',
    title: 'Estimated cost to generate one city',
    note: 'Mean estimated cost of one request at the provider’s published API prices, including web search fees (log scale). Bars span the 10th to 90th percentile of cities. You pay this to your provider with your own key.',
    scale: 'log', domain: [0.03, 0.8], ticks: [0.05, 0.1, 0.2, 0.5],
    value: (row) => row.cost, low: (row) => row.costLow, high: (row) => row.costHigh,
    format: usd, tick: (value) => `$${value.toFixed(2)}`, reference: comparison.reference.cost,
    left: '← cheaper', right: 'more expensive →',
  },
  time: {
    label: 'Time per city',
    title: 'Time to generate one city',
    note: 'Median time per city in the test runs (log scale). Bars span the 10th to 90th percentile of cities.',
    scale: 'log', domain: [0.25, 16], ticks: [0.5, 1, 2, 4, 8, 16],
    value: (row) => row.minutes, low: (row) => row.minutesLow, high: (row) => row.minutesHigh,
    format: minutes, tick: (value) => (value < 1 ? `${value * 60} s` : `${value} min`), reference: comparison.reference.minutes,
    left: '← faster', right: 'slower →',
  },
};

const rowLabel = (row: Row, short: boolean) => `${short ? row.shortModel : row.model} ${row.effort}${row.cities < 80 ? ` (${row.cities})` : ''}`;

export function ModelComparisonChart() {
  const [metric, setMetric] = useState<Metric>('accuracy');
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<{ row: Row; x: number; y: number } | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = wrapper.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    const narrow = width < 560;
    const left = narrow ? 104 : 200, right = narrow ? 58 : 76, top = 26, rowHeight = narrow ? 26 : 28, gap = 12;
    // Each row's offset: its index times the row height, plus one gap for every family boundary above it.
    const rows = comparison.rows.map((row, index) => {
      const gaps = comparison.rows.slice(1, index + 1).filter((r, i) => r.family !== comparison.rows[i].family).length;
      return { row, y: top + index * rowHeight + gaps * gap };
    });
    const end = rows.length ? rows[rows.length - 1].y + rowHeight : top;
    return { narrow, left, right, top, rowHeight, rows, bottom: end + 4, height: end + 48 };
  }, [width]);

  const m = METRICS[metric];
  const [low, high] = m.domain;
  const t = m.scale === 'log' ? Math.log : (value: number) => value;
  const x = (value: number) => layout.left + ((t(Math.min(Math.max(value, low), high)) - t(low)) / (t(high) - t(low))) * (width - layout.left - layout.right);
  const ticks = layout.narrow ? m.ticks.filter((_, index) => index % 2 === (m.ticks.length % 2 ? 0 : 1)) : m.ticks;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-8 items-center rounded-lg bg-muted p-[3px]" role="group" aria-label="Measure">
          {(Object.keys(METRICS) as Metric[]).map((key) => (
            <button
              data-analytics="estimates.model-comparison.metric"
              key={key}
              type="button"
              onClick={() => { setMetric(key); setActive(null); }}
              aria-pressed={metric === key}
              className={cn(
                'h-full rounded-md px-3 text-xs font-medium transition-colors',
                metric === key ? 'bg-foreground text-background' : 'text-foreground/70 hover:bg-background/70 hover:text-foreground'
              )}
            >
              {METRICS[key].label}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Model families">
          {FAMILIES.map((family) => (
            <li key={family.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: familyColor(family.key) }} />
              {family.label}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-700">{m.title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{m.note}</p>
      </div>
      <div ref={wrapper} className="relative min-w-0">
        <svg width={width} height={layout.height} viewBox={`0 0 ${width} ${layout.height}`} role="img" aria-label={`${m.title}. ${m.note}`} className="block max-w-full">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={layout.top - 6} y2={layout.bottom} stroke="hsl(var(--border))" />
              <text x={x(tick)} y={layout.bottom + 16} textAnchor="middle" fontSize={11} className="fill-muted-foreground tabular-nums">{m.tick(tick)}</text>
            </g>
          ))}
          <line x1={x(m.reference)} x2={x(m.reference)} y1={layout.top - 6} y2={layout.bottom} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={x(m.reference)} y={layout.top - 12} textAnchor="middle" fontSize={11} className="fill-muted-foreground">GPT-6 Luna</text>
          <text x={layout.left} y={layout.bottom + 34} fontSize={11} className="fill-muted-foreground">{m.left}</text>
          <text x={width - layout.right} y={layout.bottom + 34} textAnchor="end" fontSize={11} className="fill-muted-foreground">{m.right}</text>
          {layout.rows.map(({ row, y }) => {
            const cy = y + layout.rowHeight / 2, color = familyColor(row.family), isActive = active?.row === row;
            const show = () => setActive({ row, x: x(m.value(row)), y: cy });
            return (
              <g key={row.id} tabIndex={0} onMouseEnter={show} onMouseLeave={() => setActive(null)} onFocus={show} onBlur={() => setActive(null)}
                aria-label={`${rowLabel(row, false)}: ${m.format(m.value(row))}`} className="outline-none">
                <rect x={0} y={y + 1} width={width} height={layout.rowHeight - 2} rx={6} fill={isActive ? 'hsl(var(--muted))' : 'transparent'} />
                <text x={layout.left - 12} y={cy + 4} textAnchor="end" fontSize={layout.narrow ? 12 : 13} fontWeight={500} className="fill-foreground">{rowLabel(row, layout.narrow)}</text>
                <line x1={x(m.low(row))} x2={x(m.high(row))} y1={cy} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
                {[m.low(row), m.high(row)].map((end, index) => (
                  <line key={index} x1={x(end)} x2={x(end)} y1={cy - 5} y2={cy + 5} stroke={color} strokeWidth={2} strokeLinecap="round" />
                ))}
                <circle cx={x(m.value(row))} cy={cy} r={5.5} fill={color} stroke="hsl(var(--card))" strokeWidth={2} />
                <text x={width - layout.right + 10} y={cy + 4} fontSize={12} className="fill-muted-foreground tabular-nums">{m.format(m.value(row))}</text>
              </g>
            );
          })}
        </svg>
        {active ? (
          <div
            className="pointer-events-none absolute z-10 w-64 rounded-xl border bg-popover p-3 text-xs shadow-lg"
            style={{ left: Math.max(0, Math.min(width - 256, active.x + 14)), top: active.y + 14 }}
          >
            <p className="mb-1.5 text-[13px] font-semibold text-foreground">{rowLabel(active.row, false)}</p>
            <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">Reference cities</dt><dd className="text-right tabular-nums">{active.row.cities}</dd>
              <dt className="text-muted-foreground">Error vs Luna</dt><dd className="text-right tabular-nums">{signed(active.row.diff)} [{signed(active.row.diffLow)}, {signed(active.row.diffHigh)}]</dd>
              <dt className="text-muted-foreground">Cost per city</dt><dd className="text-right tabular-nums">{usd(active.row.cost)}</dd>
              <dt className="text-muted-foreground">Time per city</dt><dd className="text-right tabular-nums">{minutes(active.row.minutes)}</dd>
              <dt className="text-muted-foreground">Correction</dt><dd className="text-right">{active.row.correction}</dd>
            </dl>
          </div>
        ) : null}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700">All values</summary>
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead className="bg-secondary text-left font-semibold text-slate-600">
              <tr>{['Model', 'Cities', 'Error vs Luna', '95% interval', 'Cost per city', 'Time per city', 'Correction'].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-1.5 font-medium text-foreground">{row.model} {row.effort}</td>
                  <td className="px-3 py-1.5">{row.cities}</td>
                  <td className="px-3 py-1.5">{signed(row.diff)}</td>
                  <td className="px-3 py-1.5">{signed(row.diffLow)} to {signed(row.diffHigh)}</td>
                  <td className="px-3 py-1.5">{usd(row.cost)}</td>
                  <td className="px-3 py-1.5">{minutes(row.minutes)}</td>
                  <td className="px-3 py-1.5">{row.correction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
