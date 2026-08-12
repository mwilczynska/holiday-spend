export type SupportedV6MethodologyVersion = 'v6.0' | 'v6.1';

export interface V6Interval {
  lowerAud: number;
  upperAud: number;
  widthPct: number;
}

export interface V6Provenance {
  methodologyVersion: SupportedV6MethodologyVersion;
  evidenceGrades: Record<string, string>;
  intervals: Record<string, V6Interval>;
  anchorEvidenceGrades: Record<string, string>;
  anchorIntervals: Record<string, V6Interval | null>;
  collectionTelemetry: Array<{ source?: string; status?: string; attempts?: number; searchesUsed?: number }>;
  missingness: Record<string, string>;
  priorBasis: string | null;
  anchors: unknown;
  inputSnapshot: unknown;
  sources: Record<string, string>;
}

function isSupportedV6MethodologyVersion(value: unknown): value is SupportedV6MethodologyVersion {
  return value === 'v6.0' || value === 'v6.1';
}

function parseOptionalJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function readV6Provenance(
  metadataJson: string | null,
  anchorsJson?: string | null,
  inputSnapshotJson?: string | null,
  sourcesJson?: string | null,
): V6Provenance | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as {
      methodologyVersion?: unknown;
      evidenceGrades?: unknown;
      intervals?: unknown;
      anchorEvidenceGrades?: unknown;
      anchorIntervals?: unknown;
      v6CollectionTelemetry?: unknown;
      v6Missingness?: unknown;
      v6PriorBasis?: unknown;
    };
    if (!isSupportedV6MethodologyVersion(parsed.methodologyVersion)) return null;
    return {
      methodologyVersion: parsed.methodologyVersion,
      evidenceGrades: (parsed.evidenceGrades ?? {}) as Record<string, string>,
      intervals: (parsed.intervals ?? {}) as Record<string, V6Interval>,
      anchorEvidenceGrades: (parsed.anchorEvidenceGrades ?? {}) as Record<string, string>,
      anchorIntervals: (parsed.anchorIntervals ?? {}) as Record<string, V6Interval | null>,
      collectionTelemetry: (parsed.v6CollectionTelemetry ?? []) as V6Provenance['collectionTelemetry'],
      missingness: (parsed.v6Missingness ?? {}) as Record<string, string>,
      priorBasis: typeof parsed.v6PriorBasis === 'string' ? parsed.v6PriorBasis : null,
      anchors: parseOptionalJson(anchorsJson),
      inputSnapshot: parseOptionalJson(inputSnapshotJson),
      sources: (parseOptionalJson(sourcesJson) ?? {}) as Record<string, string>,
    };
  } catch {
    return null;
  }
}
