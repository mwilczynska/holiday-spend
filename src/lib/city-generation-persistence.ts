import type { CityEstimateData } from '@/types';
import type {
  CityGenerationResult,
  GeneratedCityPayload,
  V6GeneratedCityPayload,
} from './city-generation';
import type { V6CollectionResult } from './city-cost-v6-collection';
import type { V61CollectionResult } from './city-cost-v6-1-collection';
import type { V6Materialization } from './city-cost-methodology-v6';
import type { V61Materialization } from './city-cost-methodology-v6-1';

export type PersistedMethodologyVersion = CityGenerationResult['methodologyVersion'];

export interface PersistedV6Interval {
  lowerAud: number;
  upperAud: number;
  widthPct: number;
}

export interface CityEstimateMetadata {
  region: string;
  confidenceNotes: string;
  inferredAudPerUsd: number | null;
  reasoningEffort: string | null;
  methodologyVersion: PersistedMethodologyVersion;
  evidenceGrades: Record<string, string> | null;
  intervals: Record<string, PersistedV6Interval> | null;
  anchorEvidenceGrades: Record<string, string> | null;
  anchorIntervals: Record<string, PersistedV6Interval | null> | null;
  v6CollectionTelemetry: unknown[] | null;
  v6Missingness: Record<string, string> | null;
  v6PriorBasis: string | null;
  referenceDate: string | null;
  extraContext: string | null;
}

export interface CityGenerationPersistence {
  estimateSource: string;
  data: Partial<CityEstimateData>;
  anchors: unknown;
  metadata: CityEstimateMetadata;
  reasoning: string;
  confidence: GeneratedCityPayload['confidence'] | V6GeneratedCityPayload['confidence'];
  sources: Record<string, string>;
  inputSnapshot: unknown;
  fallbackLog: unknown[];
  apiSummary: {
    methodologyVersion: PersistedMethodologyVersion;
    reasoningEffort: string | null;
    evidenceGrades: Record<string, string> | null;
    intervals: Record<string, PersistedV6Interval> | null;
    collectionTelemetry: unknown[] | null;
    missingness: Record<string, string> | null;
    priorBasis: string | null;
    anchors: unknown;
    inputSnapshot: unknown;
    sources: Record<string, string>;
  };
}

function buildV1SourceMap() {
  const source = 'llm_city_generation';
  return {
    accomHostel: source,
    accomPrivateRoom: source,
    accom1star: source,
    accom2star: source,
    accom3star: source,
    accom4star: source,
    foodStreet: source,
    foodBudget: source,
    foodMid: source,
    foodHigh: source,
    drinksNone: source,
    drinksLight: source,
    drinksModerate: source,
    drinksHeavy: source,
    activitiesFree: source,
    activitiesBudget: source,
    activitiesMid: source,
    activitiesHigh: source,
  };
}

type V6Collection = V6CollectionResult | V61CollectionResult;
type V6Materialized = V6Materialization | V61Materialization;

function v6CollectionFor(generated: CityGenerationResult): V6Collection | null {
  if (generated.methodologyVersion === 'v6.1') return generated.v61Collection ?? null;
  if (generated.methodologyVersion === 'v6.0') return generated.v6Collection ?? null;
  return null;
}

function v6MaterializationFor(generated: CityGenerationResult): V6Materialized | null {
  if (generated.methodologyVersion === 'v6.1') return generated.v61Materialization ?? null;
  if (generated.methodologyVersion === 'v6.0') return generated.v6Materialization ?? null;
  return null;
}

function v6Metadata(materialization: V6Materialized | null, payload: V6GeneratedCityPayload) {
  const evidenceGrades = materialization
    ? Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.evidenceGrade]))
    : payload.evidence_grades;
  const intervals = materialization
    ? Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.interval]))
    : payload.intervals;
  const anchorEvidenceGrades = materialization
    ? Object.fromEntries(Object.entries(materialization.anchors).map(([anchor, value]) => [anchor, value.evidenceGrade]))
    : null;
  const anchorIntervals = materialization
    ? Object.fromEntries(
        Object.entries(materialization.anchors).map(([anchor, value]) => [
          anchor,
          value.valueAud === null || value.valueAud === undefined
            ? null
            : {
                lowerAud: Math.max(0, value.valueAud * (1 - (value.intervalPct ?? 45) / 100)),
                upperAud: value.valueAud * (1 + (value.intervalPct ?? 45) / 100),
                widthPct: value.intervalPct ?? 45,
              },
        ])
      )
    : null;

  return { evidenceGrades, intervals, anchorEvidenceGrades, anchorIntervals };
}

function v6SourceMap(collection: V6Collection | null) {
  return Object.fromEntries((collection?.telemetry ?? []).map((call) => [call.source, call.promptVersion]));
}

function normalizeMissingness(value: Partial<Record<string, string>> | null | undefined) {
  if (!value) return null;
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

export function buildCityEstimatePersistence(
  generated: CityGenerationResult,
  context: { referenceDate?: string; extraContext?: string } = {}
): CityGenerationPersistence {
  const { methodologyVersion } = generated;
  const isV1 = methodologyVersion === 'v1';

  if (isV1) {
    const payload = generated.payload as GeneratedCityPayload;
    const metadata: CityEstimateMetadata = {
      region: payload.region,
      confidenceNotes: payload.confidence_notes,
      inferredAudPerUsd: generated.inferredAudPerUsd,
      reasoningEffort: generated.reasoningEffort ?? null,
      methodologyVersion,
      evidenceGrades: null,
      intervals: null,
      anchorEvidenceGrades: null,
      anchorIntervals: null,
      v6CollectionTelemetry: null,
      v6Missingness: null,
      v6PriorBasis: null,
      referenceDate: context.referenceDate || null,
      extraContext: context.extraContext || null,
    };

    return {
      estimateSource: 'llm_city_generation',
      data: generated.mappedEstimate,
      anchors: payload.anchors_usd,
      metadata,
      reasoning: payload.confidence_notes,
      confidence: payload.confidence,
      sources: buildV1SourceMap(),
      inputSnapshot: payload.anchors_usd,
      fallbackLog: [],
      apiSummary: {
        methodologyVersion,
        reasoningEffort: generated.reasoningEffort ?? null,
        evidenceGrades: null,
        intervals: null,
        collectionTelemetry: null,
        missingness: null,
        priorBasis: null,
        anchors: null,
        inputSnapshot: null,
        sources: {},
      },
    };
  }

  const payload = generated.payload as V6GeneratedCityPayload;
  const collection = v6CollectionFor(generated);
  const materialization = v6MaterializationFor(generated);
  const derivedMetadata = v6Metadata(materialization, payload);
  const missingness = normalizeMissingness(materialization?.missingness);
  const priorBasis = materialization?.priorBasis ?? null;
  const telemetry = collection?.telemetry ?? null;

  const metadata: CityEstimateMetadata = {
    region: payload.region,
    confidenceNotes: payload.confidence_notes,
    inferredAudPerUsd: generated.inferredAudPerUsd,
    reasoningEffort: generated.reasoningEffort ?? null,
    methodologyVersion,
    ...derivedMetadata,
    v6CollectionTelemetry: telemetry,
    v6Missingness: missingness,
    v6PriorBasis: priorBasis,
    referenceDate: context.referenceDate || null,
    extraContext: context.extraContext || null,
  };

  return {
    estimateSource: methodologyVersion === 'v6.1' ? 'llm_city_generation_v6_1' : 'llm_city_generation_v6',
    data: generated.mappedEstimate,
    anchors: collection?.facts ?? materialization?.anchors ?? payload.anchors_aud ?? {},
    metadata,
    reasoning: payload.confidence_notes,
    confidence: payload.confidence,
    sources: v6SourceMap(collection),
    inputSnapshot: materialization?.anchors ?? payload.anchors_aud ?? {},
    fallbackLog: telemetry ?? [],
    apiSummary: {
      methodologyVersion,
      reasoningEffort: generated.reasoningEffort ?? null,
      evidenceGrades: derivedMetadata.evidenceGrades,
      intervals: derivedMetadata.intervals,
      collectionTelemetry: telemetry,
      missingness,
      priorBasis,
      anchors: collection?.facts ?? materialization?.anchors ?? payload.anchors_aud ?? {},
      inputSnapshot: materialization?.anchors ?? payload.anchors_aud ?? {},
      sources: v6SourceMap(collection),
    },
  };
}
