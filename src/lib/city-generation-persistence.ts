import type { CityEstimateData } from '@/types';
import type {
  CityGenerationResult,
  GeneratedCityPayload,
} from '@/lib/city-generation';
import type { CityCostV11AnchorResponse } from '@/lib/city-cost-methodology-v1-1';
import type { CityCostV12Materialization } from '@/lib/city-cost-methodology-v1-2';

export type PersistedMethodologyVersion = CityGenerationResult['methodologyVersion'];

export interface CityEstimatePersistenceMetadata {
  region: string;
  confidenceNotes: string;
  comparableCityReasoning: string | null;
  inferredAudPerUsd: number | null;
  reasoningEffort: string | null;
  methodologyVersion: PersistedMethodologyVersion;
  formulaVersion: string | null;
  evidenceBasis: string | null;
  fx: unknown | null;
  evidenceGrades: null;
  intervals: null;
  referenceDate: string | null;
  extraContext: string | null;
}

export interface CityGenerationPersistence {
  estimateSource: string;
  data: Partial<CityEstimateData>;
  anchors: unknown;
  metadata: CityEstimatePersistenceMetadata;
  reasoning: string;
  confidence: string;
  sources: Record<string, string>;
  inputSnapshot: unknown;
  fallbackLog: unknown[];
  apiSummary: {
    methodologyVersion: PersistedMethodologyVersion;
    reasoningEffort: string | null;
    evidenceBasis: string | null;
    formulaVersion: string | null;
    fx: unknown | null;
    evidenceGrades: null;
    intervals: null;
    anchors: unknown;
    inputSnapshot: unknown;
    sources: Record<string, string>;
  };
}

function buildSourceMap(source: string, includeDirectDrinkInputs = false) {
  const sources = {
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

  if (includeDirectDrinkInputs) {
    return {
      ...sources,
      drinkLocalBeer: source,
      drinkImportBeer: source,
      drinkWineGlass: source,
      drinkCocktail: source,
      drinkCoffee: source,
    };
  }

  return sources;
}

export function buildCityEstimatePersistence(
  generated: CityGenerationResult,
  context: {
    cityName: string;
    countryName: string;
    referenceDate?: string;
    extraContext?: string;
  }
): CityGenerationPersistence {
  if (generated.methodologyVersion === 'v1') {
    const payload = generated.payload as GeneratedCityPayload;
    const source = 'llm_city_generation';
    const metadata: CityEstimatePersistenceMetadata = {
      region: payload.region,
      confidenceNotes: payload.confidence_notes,
      comparableCityReasoning: null,
      inferredAudPerUsd: generated.inferredAudPerUsd,
      reasoningEffort: generated.reasoningEffort ?? null,
      methodologyVersion: 'v1',
      formulaVersion: null,
      evidenceBasis: null,
      fx: null,
      evidenceGrades: null,
      intervals: null,
      referenceDate: context.referenceDate || null,
      extraContext: context.extraContext || null,
    };

    return {
      estimateSource: source,
      data: generated.mappedEstimate,
      anchors: payload.anchors_usd,
      metadata,
      reasoning: payload.confidence_notes,
      confidence: payload.confidence,
      sources: buildSourceMap(source),
      inputSnapshot: payload.anchors_usd,
      fallbackLog: [],
      apiSummary: {
        methodologyVersion: 'v1',
        reasoningEffort: generated.reasoningEffort ?? null,
        evidenceBasis: null,
        formulaVersion: null,
        fx: null,
        evidenceGrades: null,
        intervals: null,
        anchors: null,
        inputSnapshot: null,
        sources: {},
      },
    };
  }

  const payload = generated.payload as CityCostV11AnchorResponse;
  const materialization = generated.v11Materialization;
  if (!materialization) {
    throw new Error(`${generated.methodologyVersion} generation result is missing its deterministic materialization.`);
  }

  const isV12 = generated.methodologyVersion === 'v1.2';
  const correction = isV12 ? (materialization as CityCostV12Materialization).correction : null;
  const rawAnchorsUsd = isV12 ? (materialization as CityCostV12Materialization).rawAnchorsUsd : null;
  const source = isV12 ? 'llm_city_generation_v1_2' : 'llm_city_generation_v1_1';
  const sources = buildSourceMap(source, true);
  const metadata: CityEstimatePersistenceMetadata = {
    region: payload.region,
    confidenceNotes: payload.confidence_notes,
    comparableCityReasoning: payload.comparable_city_reasoning,
    inferredAudPerUsd: generated.inferredAudPerUsd,
    reasoningEffort: generated.reasoningEffort ?? null,
    methodologyVersion: generated.methodologyVersion,
    formulaVersion: materialization.formulaVersion,
    evidenceBasis: isV12 ? 'model_estimate_with_food_drink_search_and_reference_correction' : 'holistic_model_estimate',
    fx: materialization.fx,
    evidenceGrades: null,
    intervals: null,
    referenceDate: context.referenceDate || null,
    extraContext: context.extraContext || null,
  };
  // For v1.2, `values` are the corrected USD anchors the tiers were built from; `rawValues` are the model's own.
  const anchors = {
    currency: 'USD',
    values: materialization.anchorsUsd,
    convertedCurrency: 'AUD',
    valuesAud: materialization.anchorsAud,
    ...(isV12 ? { rawValues: rawAnchorsUsd, correction } : {}),
  };
  const inputSnapshot = {
    cityName: context.cityName,
    countryName: context.countryName,
    referenceDate: context.referenceDate || null,
    extraContext: context.extraContext || null,
    anchorResponse: payload,
    fx: materialization.fx,
    ...(isV12 ? { correction } : {}),
  };

  return {
    estimateSource: source,
    data: generated.mappedEstimate,
    anchors,
    metadata,
    reasoning: payload.confidence_notes,
    confidence: payload.confidence,
    sources,
    inputSnapshot,
    fallbackLog: [],
    apiSummary: {
      methodologyVersion: generated.methodologyVersion,
      reasoningEffort: generated.reasoningEffort ?? null,
      evidenceBasis: metadata.evidenceBasis,
      formulaVersion: metadata.formulaVersion,
      fx: materialization.fx,
      evidenceGrades: null,
      intervals: null,
      anchors,
      inputSnapshot,
      sources,
    },
  };
}
