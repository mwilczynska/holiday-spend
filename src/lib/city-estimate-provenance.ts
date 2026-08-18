export interface CityEstimateProvenance {
  methodologyVersion: string;
  source: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  reasoningEffort: string | null;
  evidenceBasis: string | null;
  formulaVersion: string | null;
  confidence: string | null;
  confidenceNotes: string | null;
  comparableCityReasoning: string | null;
  inferredAudPerUsd: number | null;
  fx: unknown | null;
  anchors: unknown | null;
  inputSnapshot: unknown | null;
  sources: Record<string, unknown>;
  evidenceGrades: Record<string, unknown> | null;
  intervals: Record<string, unknown> | null;
  collectionTelemetry: unknown[] | null;
  missingness: Record<string, unknown> | null;
  priorBasis: string | null;
}

function parseJson(value: string | null | undefined): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function inferMethodologyVersion(source: string | null | undefined, metadata: Record<string, unknown>) {
  if (typeof metadata.methodologyVersion === 'string') return metadata.methodologyVersion;
  if (source === 'llm_city_generation_v1_1') return 'v1.1';
  if (source === 'llm_city_generation_v6_1') return 'v6.1';
  if (source === 'llm_city_generation_v6') return 'v6.0';
  return 'v1';
}

export function readCityEstimateProvenance(params: {
  source?: string | null;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  confidence?: string | null;
  metadataJson?: string | null;
  anchorsJson?: string | null;
  inputSnapshotJson?: string | null;
  sourcesJson?: string | null;
}): CityEstimateProvenance | null {
  const metadataValue = parseJson(params.metadataJson);
  const metadata = asRecord(metadataValue);
  const hasAnyData = Boolean(params.metadataJson || params.anchorsJson || params.inputSnapshotJson || params.sourcesJson);
  if (!hasAnyData) return null;
  if (params.metadataJson && metadataValue === null && !params.anchorsJson && !params.inputSnapshotJson && !params.sourcesJson) {
    return null;
  }

  const sources = asRecord(parseJson(params.sourcesJson));
  const evidenceGrades = asRecord(metadata.evidenceGrades ?? metadata.v6EvidenceGrades);
  const intervals = asRecord(metadata.intervals ?? metadata.v6Intervals);
  const telemetry = metadata.collectionTelemetry ?? metadata.v6CollectionTelemetry;
  const missingness = metadata.missingness ?? metadata.v6Missingness;
  const priorBasis = metadata.priorBasis ?? metadata.v6PriorBasis;

  return {
    methodologyVersion: inferMethodologyVersion(params.source, metadata),
    source: params.source ?? null,
    provider: params.provider ?? null,
    model: params.model ?? null,
    promptVersion: params.promptVersion ?? null,
    reasoningEffort: asNullableString(metadata.reasoningEffort),
    evidenceBasis: asNullableString(metadata.evidenceBasis),
    formulaVersion: asNullableString(metadata.formulaVersion),
    confidence: params.confidence ?? null,
    confidenceNotes: asNullableString(metadata.confidenceNotes),
    comparableCityReasoning: asNullableString(metadata.comparableCityReasoning),
    inferredAudPerUsd:
      typeof metadata.inferredAudPerUsd === 'number' && Number.isFinite(metadata.inferredAudPerUsd)
        ? metadata.inferredAudPerUsd
        : null,
    fx: metadata.fx ?? null,
    anchors: parseJson(params.anchorsJson),
    inputSnapshot: parseJson(params.inputSnapshotJson),
    sources,
    evidenceGrades: Object.keys(evidenceGrades).length ? evidenceGrades : null,
    intervals: Object.keys(intervals).length ? intervals : null,
    collectionTelemetry: Array.isArray(telemetry) ? telemetry : null,
    missingness: Object.keys(asRecord(missingness)).length ? asRecord(missingness) : null,
    priorBasis: asNullableString(priorBasis),
  };
}
