'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared dashboard chart parts.
 *
 * These moved out of `src/app/page.tsx` so the three chart components could be loaded with
 * `next/dynamic`. Nothing in this file imports Recharts, which is the point: `page.tsx` still
 * imports these statically, so they must not drag the charting library back into the initial
 * bundle. Keep it that way — a Recharts import here silently undoes the split.
 */

/** Reserves the chart's space while its dynamic chunk loads, so the page does not shift. */
export function DashboardChartPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-md bg-muted/40"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export type CategoryMode = 'actual' | 'planned';
export type ChartRenderMode = 'inline' | 'expanded';
export type ResponsiveChartHeight = number | '100%';

export interface BurnRatePoint {
  date: string;
  cumulative: number;
  daily: number;
  plannedCumulative: number;
  plannedDaily: number;
  countryName: string | null;
  cityName: string | null;
  legStatus: string | null;
}

export interface CountryBand {
  countryName: string;
  startDate: string;
  endDate: string;
  pointCount: number;
}

export interface StaggeredCountryBand extends CountryBand {
  labelLevel: number;
  segmentStartRatio: number;
  segmentEndRatio: number;
}

export interface WrappedCategoryTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string;
  };
  maxWidth?: number;
  fontSize?: number;
  lineHeight?: number;
}

export const COUNTRY_BAND_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#cffafe'];

export const BURN_COUNTRY_LABEL_TOP_OFFSET = 4;
export const BURN_COUNTRY_LABEL_ROW_GAP = 4;

export const fmtAud = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

export function getBurnChartMetrics(mode: ChartRenderMode) {
  return mode === 'expanded'
    ? {
        margin: { top: 2, right: 28, left: 16, bottom: 22 },
        yAxisWidth: 92,
        countryLabelFontSize: 13,
        countryLabelLineHeight: 1.3,
        countryStripPaddingBottom: 2,
        legendGap: 2,
        legendSwatchWidth: 30,
        legendFontSize: 13,
      }
    : {
        margin: { top: 12, right: 16, left: 8, bottom: 16 },
        yAxisWidth: 76,
        countryLabelFontSize: 11,
        countryLabelLineHeight: 1.15,
        countryStripPaddingBottom: 8,
        legendGap: 4,
        legendSwatchWidth: 24,
        legendFontSize: 12,
      };
}

export function wrapTickLabel(value: string, maxCharsPerLine: number, maxLines: number) {
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
      ? `${truncated.slice(0, Math.max(maxCharsPerLine - 1, 1)).trimEnd()}…`
      : `${truncated}…`;
  }

  return lines;
}

export function WrappedCategoryTick({
  x = 0,
  y = 0,
  payload,
  maxWidth = 116,
  fontSize = 10,
  lineHeight = 12,
}: WrappedCategoryTickProps) {
  const rawValue = payload?.value ?? '';
  const lines = wrapTickLabel(rawValue, Math.max(8, Math.floor(maxWidth / 6.6)), 2);
  const resolvedX = typeof x === 'number' ? x : Number(x ?? 0);
  const resolvedY = typeof y === 'number' ? y : Number(y ?? 0);
  const startY = resolvedY - ((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={resolvedX}
      y={startY}
      textAnchor="end"
      fill="#475569"
      fontSize={fontSize}
    >
      {lines.map((line, index) => (
        <tspan key={`${rawValue}-${index}`} x={resolvedX} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function BurnRateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BurnRatePoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">
        {point.cityName && point.countryName
          ? `${point.cityName}, ${point.countryName}`
          : point.countryName || 'Outside planned legs'}
      </div>
      <div className="mt-2 space-y-1">
        {[
          {
            label: point.legStatus === 'planned' ? 'Actual spend · leg still planned' : 'Actual spend',
            color: point.legStatus === 'planned' ? '#9ca3af' : '#16a34a',
            value: point.cumulative,
          },
          { label: 'Planned estimate', color: '#0f766e', value: point.plannedCumulative },
        ].map((entry) => (
          <div key={entry.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.label}</span>
            </div>
            <span className="font-medium">{fmtAud(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function getBurnRateLegendItems(includeBudget: boolean) {
  return [
    { label: 'Actual spend', color: '#16a34a' },
    { label: 'Actual spend · leg still planned', color: '#9ca3af' },
    { label: 'Planned estimate', color: '#0f766e', dashed: true },
    ...(includeBudget ? [{ label: 'Total trip budget', color: '#7c3aed', dashed: true }] : []),
  ];
}

export function BurnRateLegend({
  includeBudget,
  mode,
}: {
  includeBudget: boolean;
  mode: ChartRenderMode;
}) {
  const metrics = getBurnChartMetrics(mode);
  const items = getBurnRateLegendItems(includeBudget);

  return (
    <div
      className="flex flex-wrap items-center justify-center text-muted-foreground"
      style={{
        gap: mode === 'expanded' ? 20 : 16,
        paddingBottom: metrics.legendGap,
        fontSize: metrics.legendFontSize,
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5"
            style={{
              width: metrics.legendSwatchWidth,
              backgroundColor: item.dashed ? undefined : item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
              height: item.dashed ? 0 : undefined,
            }}
          />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ExpandedChartLegend({
  items,
  mode = 'expanded',
  className,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>;
  mode?: ChartRenderMode;
  className?: string;
}) {
  const fontSize = mode === 'expanded' ? 13 : 11;
  const swatchWidth = mode === 'expanded' ? 26 : 20;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground', className)}
      style={{ fontSize }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-0.5"
            style={{
              width: swatchWidth,
              backgroundColor: item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
              height: item.dashed ? 0 : undefined,
            }}
          />
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function buildStaggeredCountryBands(bands: CountryBand[], totalPointCount: number): StaggeredCountryBand[] {
  if (bands.length === 0 || totalPointCount <= 0) return [];

  const estimatedPlotWidthPx = 760;
  const pointsPerPixel = totalPointCount > 1 ? (totalPointCount - 1) / estimatedPlotWidthPx : 1;
  const levelEndByIndex: number[] = [];
  let pointCursor = 0;

  return bands.map((band) => {
    const bandStart = pointCursor;
    const bandEnd = pointCursor + Math.max(band.pointCount - 1, 0);
    const segmentStartRatio = bandStart / totalPointCount;
    const segmentEndRatio = (bandStart + Math.max(band.pointCount, 1)) / totalPointCount;
    pointCursor += band.pointCount;

    const estimatedLabelWidthInPoints = Math.max(
      band.pointCount,
      Math.max(band.countryName.length * 7 * pointsPerPixel, 3)
    );
    const labelMidpoint = (bandStart + bandEnd) / 2;
    const labelStart = labelMidpoint - estimatedLabelWidthInPoints / 2;
    const labelEnd = labelMidpoint + estimatedLabelWidthInPoints / 2;

    let labelLevel = 0;
    while (levelEndByIndex[labelLevel] != null && labelStart <= levelEndByIndex[labelLevel]) {
      labelLevel += 1;
    }
    levelEndByIndex[labelLevel] = labelEnd;

    return {
      ...band,
      labelLevel,
      segmentStartRatio,
      segmentEndRatio,
    };
  });
}

export function getCountryBandKey(band: Pick<CountryBand, 'countryName' | 'startDate' | 'endDate'>) {
  return `${band.countryName}-${band.startDate}-${band.endDate}`;
}

export function BurnCountryHeaderStrip({
  bands,
  mode,
}: {
  bands: StaggeredCountryBand[];
  mode: ChartRenderMode;
}) {
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stripInnerRef = useRef<HTMLDivElement>(null);
  const metrics = getBurnChartMetrics(mode);
  const [layout, setLayout] = useState(() => ({
    rowOffsets: [] as number[],
    stripHeight: 24,
  }));

  useLayoutEffect(() => {
    if (bands.length === 0) return;

    const measure = () => {
      const maxLabelLevel = bands.reduce((maxLevel, band) => Math.max(maxLevel, band.labelLevel), 0);
      const rowHeights = Array.from({ length: maxLabelLevel + 1 }, () => 14);

      for (const band of bands) {
        const labelNode = labelRefs.current[getCountryBandKey(band)];
        if (!labelNode) continue;
        const labelHeight = labelNode.getBoundingClientRect().height;
        rowHeights[band.labelLevel] = Math.max(rowHeights[band.labelLevel] ?? 14, Math.ceil(labelHeight));
      }

      const rowOffsets: number[] = [];
      let cursor = BURN_COUNTRY_LABEL_TOP_OFFSET;

      for (let index = 0; index < rowHeights.length; index += 1) {
        rowOffsets[index] = cursor;
        cursor += rowHeights[index] + BURN_COUNTRY_LABEL_ROW_GAP;
      }

      const stripHeight = cursor;

      setLayout((currentLayout) => {
        const sameHeight = currentLayout.stripHeight === stripHeight;
        const sameOffsets =
          currentLayout.rowOffsets.length === rowOffsets.length &&
          currentLayout.rowOffsets.every((offset, index) => offset === rowOffsets[index]);

        if (sameHeight && sameOffsets) {
          return currentLayout;
        }

        return {
          rowOffsets,
          stripHeight,
        };
      });
    };

    measure();

    if (!stripInnerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(measure);
    });

    resizeObserver.observe(stripInnerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [bands, mode]);

  if (bands.length === 0) return null;

  return (
    <div
      className="pointer-events-none"
      style={{
        paddingLeft: metrics.margin.left + metrics.yAxisWidth,
        paddingRight: metrics.margin.right,
        paddingBottom: metrics.countryStripPaddingBottom,
      }}
    >
      <div ref={stripInnerRef} className="relative" style={{ height: layout.stripHeight }}>
        {bands.map((band) => {
          const left = `${band.segmentStartRatio * 100}%`;
          const width = `${Math.max((band.segmentEndRatio - band.segmentStartRatio) * 100, 2)}%`;

          return (
            <div
              key={getCountryBandKey(band)}
              className="absolute"
              style={{
                left,
                width,
                top: layout.rowOffsets[band.labelLevel] ?? BURN_COUNTRY_LABEL_TOP_OFFSET,
              }}
            >
              <div
                ref={(node) => {
                  labelRefs.current[getCountryBandKey(band)] = node;
                }}
                className="px-1 text-center font-bold text-slate-600"
                style={{
                  fontSize: metrics.countryLabelFontSize,
                  lineHeight: metrics.countryLabelLineHeight,
                }}
              >
                {band.countryName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
