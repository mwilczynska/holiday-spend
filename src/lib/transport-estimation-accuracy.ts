import type { TransportEstimateCitation, TransportEstimateMode, TransportEstimateOption } from '@/types';

export interface TransportAccuracyReference {
  routeId: string;
  routeClass: 'domestic_short' | 'domestic_long' | 'international_short' | 'international_long';
  originCity: string;
  originCountry: string;
  destinationCity: string;
  destinationCountry: string;
  travelDate: string;
  capturedAt: string;
  groupSize: number;
  referenceMode: TransportEstimateMode;
  referenceTotalAud: number;
  referenceSource: string;
}

export interface TransportAccuracyObservation extends TransportAccuracyReference {
  provider: string;
  model: string;
  promptVersion: string;
  usedWebSearch: boolean;
  fallbackReason: string | null;
  searchQueries: string[];
  citations: TransportEstimateCitation[];
  assumptions: string[];
  options: TransportEstimateOption[];
}

export interface TransportAccuracyRow extends TransportAccuracyReference {
  provider: string;
  model: string;
  usedWebSearch: boolean;
  fallbackReason: string | null;
  searchQueries: string[];
  citations: TransportEstimateCitation[];
  assumptions: string[];
  matchedMode: boolean;
  estimatedTotalAud: number | null;
  absoluteErrorAud: number | null;
  relativeError: number | null;
}

export interface TransportAccuracyReport {
  tolerance: number;
  rows: TransportAccuracyRow[];
  summary: {
    matchedRoutes: number;
    missingModeRoutes: number;
    medianAbsoluteErrorAud: number | null;
    medianRelativeError: number | null;
    absoluteErrorRangeAud: [number, number] | null;
    relativeErrorRange: [number, number] | null;
  };
  outliers: TransportAccuracyRow[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function range(values: number[]): [number, number] | null {
  if (values.length === 0) return null;
  return [Math.min(...values), Math.max(...values)];
}

/**
 * Compares one returned option per route with a same-assumption reference
 * quote. This intentionally reports directional error only; it is not a
 * statistical benchmark and does not infer a tolerance for the product.
 */
export function buildTransportAccuracyReport(
  observations: readonly TransportAccuracyObservation[],
  tolerance = 0.25
): TransportAccuracyReport {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error('Transport accuracy tolerance must be a finite non-negative number.');
  }

  const rows = observations.map<TransportAccuracyRow>((observation) => {
    const option = observation.options.find((candidate) => candidate.mode === observation.referenceMode);
    const estimatedTotalAud = option?.totalAud ?? null;
    const absoluteErrorAud = estimatedTotalAud == null
      ? null
      : Math.abs(estimatedTotalAud - observation.referenceTotalAud);
    const relativeError = absoluteErrorAud == null || observation.referenceTotalAud <= 0
      ? null
      : absoluteErrorAud / observation.referenceTotalAud;

    return {
      routeId: observation.routeId,
      routeClass: observation.routeClass,
      originCity: observation.originCity,
      originCountry: observation.originCountry,
      destinationCity: observation.destinationCity,
      destinationCountry: observation.destinationCountry,
      travelDate: observation.travelDate,
      capturedAt: observation.capturedAt,
      groupSize: observation.groupSize,
      referenceMode: observation.referenceMode,
      referenceTotalAud: observation.referenceTotalAud,
      referenceSource: observation.referenceSource,
      provider: observation.provider,
      model: observation.model,
      usedWebSearch: observation.usedWebSearch,
      fallbackReason: observation.fallbackReason,
      searchQueries: observation.searchQueries,
      citations: observation.citations,
      assumptions: observation.assumptions,
      matchedMode: option != null,
      estimatedTotalAud,
      absoluteErrorAud,
      relativeError,
    };
  });

  const matchedRows = rows.filter((row) => row.matchedMode && row.relativeError != null);
  const absoluteErrors = matchedRows.flatMap((row) => row.absoluteErrorAud == null ? [] : [row.absoluteErrorAud]);
  const relativeErrors = matchedRows.flatMap((row) => row.relativeError == null ? [] : [row.relativeError]);

  return {
    tolerance,
    rows,
    summary: {
      matchedRoutes: matchedRows.length,
      missingModeRoutes: rows.length - matchedRows.length,
      medianAbsoluteErrorAud: median(absoluteErrors),
      medianRelativeError: median(relativeErrors),
      absoluteErrorRangeAud: range(absoluteErrors),
      relativeErrorRange: range(relativeErrors),
    },
    outliers: rows.filter((row) => !row.matchedMode || (row.relativeError != null && row.relativeError > tolerance)),
  };
}
