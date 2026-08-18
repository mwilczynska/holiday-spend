import type { CityEstimateData } from '@/types';
import type {
  CityGenerationResult,
  GeneratedCityPayload,
} from '@/lib/city-generation';
import type { CityCostV11AnchorResponse } from '@/lib/city-cost-methodology-v1-1';

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
    throw new Error('v1.1 generation result is missing its deterministic materialization.');
  }

  const source = 'llm_city_generation_v1_1';
  const sources = buildSourceMap(source, true);
  const metadata: CityEstimatePersistenceMetadata = {
    region: payload.region,
    confidenceNotes: payload.confidence_notes,
    comparableCityReasoning: payload.comparable_city_reasoning,
    inferredAudPerUsd: generated.inferredAudPerUsd,
    reasoningEffort: generated.reasoningEffort ?? null,
    methodologyVersion: 'v1.1',
    formulaVersion: materialization.formulaVersion,
    evidenceBasis: 'holistic_model_estimate',
    fx: materialization.fx,
    evidenceGrades: null,
    intervals: null,
    referenceDate: context.referenceDate || null,
    extraContext: context.extraContext || null,
  };
  const anchors = {
    currency: 'USD',
    values: materialization.anchorsUsd,
    convertedCurrency: 'AUD',
    valuesAud: materialization.anchorsAud,
  };
  const inputSnapshot = {
    cityName: context.cityName,
    countryName: context.countryName,
    referenceDate: context.referenceDate || null,
    extraContext: context.extraContext || null,
    anchorResponse: payload,
    fx: materialization.fx,
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
      methodologyVersion: 'v1.1',
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
