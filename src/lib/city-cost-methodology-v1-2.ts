import lunaCorrections from '@/lib/data/city-cost-corrections-v1-2.json';
import { findKnownCountryMetadata } from '@/lib/country-metadata';
import {
  cityCostV11AnchorResponseSchema,
  materializeCityCostV11,
  type CityCostV11AnchorResponse,
  type CityCostV11AnchorsUsd,
  type CityCostV11Materialization,
} from '@/lib/city-cost-methodology-v1-1';

// v1.2 keeps the v1.1 contract (ten USD anchors plus a dated RBA observation, all arithmetic on the server) and changes
// two things, both measured in the city-cost hill-climb research (bundle 022, confirmed on held-out cities):
// the prompt allows up to five searches for food and drink prices, and the server multiplies selected USD anchors by
// a fixed, versioned correction table before the unchanged v1 tier formulas and USD to AUD conversion.
export const CITY_COST_V12_METHODOLOGY_VERSION = 'v1.2' as const;
export const CITY_COST_V12_PROMPT_VERSION = 'llm_prompt_new_cities_v1_2.md';
/** The prompt allows one RBA search plus up to five food and drink searches; providers with a per-request cap get this. */
export const CITY_COST_V12_MAX_WEB_SEARCHES = 6;

type AnchorKey = keyof CityCostV11AnchorsUsd;
type CountryFactor = { factor: number; cities: number; region: string };
type CorrectionTable = {
  version: string;
  fittedOn: { model: string; cities: number };
  correctedAnchors: string[];
  global: Record<string, number>;
  region: Record<string, Record<string, number>>;
  country: Record<string, Record<string, CountryFactor>>;
};

const LUNA_TABLE = lunaCorrections as unknown as CorrectionTable;

/**
 * Correction tables by the model whose answers they were fitted on. A table encodes one model's systematic biases (for
 * example how far its 3-star prices sit above booking prices), so it is only exact for that model. A model without its
 * own table uses the default table, and the estimate records the table's model and whether it matched, so the
 * difference is visible in provenance. Add a table here once a model's answers on the reference cities have been fitted
 * on the research branch (build-production-corrections.mjs).
 */
const CORRECTION_TABLES: Array<{ table: CorrectionTable; models: RegExp }> = [
  { table: LUNA_TABLE, models: /^gpt-6-luna(?:-|$)/ },
];
const DEFAULT_CORRECTION_TABLE = LUNA_TABLE;

/** The version of the default table; tables for other models carry their own version. */
export const CITY_COST_V12_CORRECTION_VERSION: string = DEFAULT_CORRECTION_TABLE.version;

/** OpenRouter-style IDs ("openai/gpt-6-luna") match on the model part. */
function modelKey(model: string) {
  return model.trim().toLowerCase().split('/').pop() ?? '';
}

/** The table fitted for this model, or the default table; `fittedForModel` is null when the model is not known. */
export function selectCityCostV12CorrectionTable(model?: string | null) {
  const own = model ? CORRECTION_TABLES.find((entry) => entry.models.test(modelKey(model)))?.table : undefined;
  return { table: own ?? DEFAULT_CORRECTION_TABLE, fittedForModel: model ? Boolean(own) : null };
}

export type CityCostV12CorrectionBasis = 'country' | 'region' | 'global' | 'none';

export interface CityCostV12AnchorCorrection {
  factor: number;
  basis: CityCostV12CorrectionBasis;
}

export interface CityCostV12Correction {
  version: string;
  /** The model whose answers the table was fitted on, as recorded in the table. */
  fittedFor: string;
  /** Whether the table was fitted for the model that produced this estimate; null when that model is not known. */
  fittedForModel: boolean | null;
  countryCode: string | null;
  region: string;
  anchors: Record<AnchorKey, CityCostV12AnchorCorrection>;
}

export interface CityCostV12Materialization extends Omit<CityCostV11Materialization, 'methodologyVersion'> {
  methodologyVersion: typeof CITY_COST_V12_METHODOLOGY_VERSION;
  /** The model's own USD anchors, before correction. */
  rawAnchorsUsd: CityCostV11AnchorsUsd;
  correction: CityCostV12Correction;
}

function roundFactorProduct(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Looks up the correction factor for every anchor: the country factor when the country has reference cities (already
 * shrunk towards its region), otherwise the region factor, otherwise the global factor. Anchors without a correction
 * keep factor 1. An unknown country falls back to the region, so a city outside the reference panel is still corrected.
 */
export function resolveCityCostV12Correction(countryName: string, region: string, model?: string | null): CityCostV12Correction {
  const { table: TABLE, fittedForModel } = selectCityCostV12CorrectionTable(model);
  const countryCode = findKnownCountryMetadata(countryName)?.iso2 ?? null;
  const anchors = {} as Record<AnchorKey, CityCostV12AnchorCorrection>;
  const keys = Object.keys(cityCostV11AnchorResponseSchema.shape.anchors_usd.shape) as AnchorKey[];

  for (const anchor of keys) {
    if (!TABLE.correctedAnchors.includes(anchor)) {
      anchors[anchor] = { factor: 1, basis: 'none' };
      continue;
    }
    const country = countryCode ? TABLE.country[anchor]?.[countryCode] : undefined;
    if (country) anchors[anchor] = { factor: country.factor, basis: 'country' };
    else if (TABLE.region[anchor]?.[region] !== undefined) anchors[anchor] = { factor: TABLE.region[anchor][region], basis: 'region' };
    else anchors[anchor] = { factor: TABLE.global[anchor], basis: 'global' };
  }

  return { version: TABLE.version, fittedFor: TABLE.fittedOn.model, fittedForModel, countryCode, region, anchors };
}

export function applyCityCostV12Correction(
  anchorsUsd: CityCostV11AnchorsUsd,
  correction: CityCostV12Correction
): CityCostV11AnchorsUsd {
  return Object.fromEntries(
    Object.entries(anchorsUsd).map(([key, value]) => [key, roundFactorProduct(value * correction.anchors[key as AnchorKey].factor)])
  ) as CityCostV11AnchorsUsd;
}

/**
 * Validates the v1.1-shaped response, corrects its USD anchors for the requested country, then materializes the
 * corrected anchors with the unchanged v1.1 FX validation, v1 tier formulas and USD to AUD conversion.
 */
export function materializeCityCostV12(
  input: unknown,
  context: { countryName: string; model?: string | null },
  now = new Date()
): CityCostV12Materialization {
  const parsed: CityCostV11AnchorResponse = cityCostV11AnchorResponseSchema.parse(input);
  const correction = resolveCityCostV12Correction(context.countryName, parsed.region, context.model);
  const corrected = applyCityCostV12Correction(parsed.anchors_usd, correction);
  const base = materializeCityCostV11({ ...parsed, anchors_usd: corrected }, now);

  return {
    ...base,
    methodologyVersion: CITY_COST_V12_METHODOLOGY_VERSION,
    rawAnchorsUsd: parsed.anchors_usd,
    correction,
  };
}
