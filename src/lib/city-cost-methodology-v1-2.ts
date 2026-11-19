import lunaCorrections from '@/lib/data/city-cost-corrections-v1-2.json';
import modelAdjustments from '@/lib/data/city-cost-model-adjustments-v1-2.json';
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

const COUNTRY_TABLE = lunaCorrections as unknown as CorrectionTable;

type ModelAdjustmentEntry = { id: string; label: string; match: string; factors: Record<string, number>; cities?: number };
type ModelAdjustments = {
  version: string;
  countryLayer: string;
  correctedAnchors: string[];
  reference: ModelAdjustmentEntry;
  unmeasuredDefault: { lambda: number; models: string[]; factors: Record<string, number> };
  models: ModelAdjustmentEntry[];
};
const ADJUSTMENTS = modelAdjustments as unknown as ModelAdjustments;
if (ADJUSTMENTS.countryLayer !== COUNTRY_TABLE.version) {
  throw new Error(`City-cost model adjustments ${ADJUSTMENTS.version} were fitted on country table ${ADJUSTMENTS.countryLayer}, not ${COUNTRY_TABLE.version}.`);
}
const REFERENCE_MATCH = new RegExp(ADJUSTMENTS.reference.match);
const MEASURED = ADJUSTMENTS.models.map((entry) => ({ entry, match: new RegExp(entry.match) }));

/** The version of the country table, which is also the full correction version for the reference model (GPT-6 Luna). */
export const CITY_COST_V12_CORRECTION_VERSION: string = COUNTRY_TABLE.version;
export const CITY_COST_V12_MODEL_ADJUSTMENTS_VERSION: string = ADJUSTMENTS.version;

/**
 * Model IDs as stored: OpenRouter-style prefixes ("openai/gpt-6-luna") and runtime notes ("gpt-6-luna (Codex subagent)")
 * are dropped, so every way of naming one model selects the same adjustment.
 */
export function cityCostModelKey(model: string) {
  return model.trim().toLowerCase().replace(/\s*\(.*\)\s*$/, '').split('/').pop()?.trim() ?? '';
}

export type CityCostV12ModelAdjustmentBasis = 'reference' | 'measured' | 'default';

export interface CityCostV12ModelAdjustment {
  version: string;
  /**
   * reference: the model the country table was fitted on (factor 1); measured: the model's own calibration;
   * default: a model without its own calibration, which gets half the average adjustment of the measured models.
   */
  basis: CityCostV12ModelAdjustmentBasis;
  /** The adjustment entry used; null for the unmeasured default. */
  model: string | null;
  label: string | null;
  factors: Record<string, number>;
}

/**
 * Two-layer v1.2 correction (19 November 2026): a country layer fitted on GPT-6 Luna's answers for 475 reference
 * cities, times a model layer of one factor per corrected anchor. The model layer captures how a model's prices differ
 * from Luna's (for example Claude and newer GPT models price 3-star rooms closer to booking prices, so Luna's 3-star
 * factor overshoots them). Measured models were calibrated on 80 reference cities; any other model gets the
 * unmeasured default, which the research measured as better than Luna's layer alone for a model it had not seen.
 */
export function resolveCityCostV12ModelAdjustment(model?: string | null): CityCostV12ModelAdjustment {
  const key = model ? cityCostModelKey(model) : '';
  if (key && REFERENCE_MATCH.test(key)) {
    const { id, label, factors } = ADJUSTMENTS.reference;
    return { version: ADJUSTMENTS.version, basis: 'reference', model: id, label, factors };
  }
  const measured = key ? MEASURED.find(({ match }) => match.test(key))?.entry : undefined;
  if (measured) return { version: ADJUSTMENTS.version, basis: 'measured', model: measured.id, label: measured.label, factors: measured.factors };
  return { version: ADJUSTMENTS.version, basis: 'default', model: null, label: null, factors: ADJUSTMENTS.unmeasuredDefault.factors };
}

/**
 * The correction version an estimate from this model should carry: the country table alone for the reference model,
 * otherwise the country table plus the model adjustments. Recorrection compares stored versions against this.
 */
export function cityCostV12CorrectionVersionFor(model?: string | null) {
  const adjustment = resolveCityCostV12ModelAdjustment(model);
  return adjustment.basis === 'reference' ? COUNTRY_TABLE.version : `${COUNTRY_TABLE.version}+${adjustment.version}`;
}

export type CityCostV12CorrectionBasis = 'country' | 'region' | 'global' | 'none';

export interface CityCostV12AnchorCorrection {
  /** The factor applied: country layer times model layer. */
  factor: number;
  basis: CityCostV12CorrectionBasis;
  countryFactor?: number;
  modelFactor?: number;
}

export interface CityCostV12Correction {
  version: string;
  /** The model the country layer was fitted on, as recorded in the table. */
  fittedFor: string;
  /** Whether the answering model has its own calibration (reference or measured); null when the model is not known. */
  fittedForModel: boolean | null;
  modelAdjustment: CityCostV12ModelAdjustment;
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
 * Looks up the correction factor for every anchor. The country layer uses the country factor when the country has
 * reference cities (already shrunk towards its region), otherwise the region factor, otherwise the global factor; an
 * unknown country falls back to the region, so a city outside the reference panel is still corrected. The model layer
 * multiplies that by the answering model's factor. Anchors without a correction keep factor 1.
 */
export function resolveCityCostV12Correction(countryName: string, region: string, model?: string | null): CityCostV12Correction {
  const modelAdjustment = resolveCityCostV12ModelAdjustment(model);
  const countryCode = findKnownCountryMetadata(countryName)?.iso2 ?? null;
  const anchors = {} as Record<AnchorKey, CityCostV12AnchorCorrection>;
  const keys = Object.keys(cityCostV11AnchorResponseSchema.shape.anchors_usd.shape) as AnchorKey[];

  for (const anchor of keys) {
    if (!COUNTRY_TABLE.correctedAnchors.includes(anchor)) {
      anchors[anchor] = { factor: 1, basis: 'none' };
      continue;
    }
    const country = countryCode ? COUNTRY_TABLE.country[anchor]?.[countryCode] : undefined;
    let basis: CityCostV12CorrectionBasis;
    let countryFactor: number;
    if (country) {
      basis = 'country';
      countryFactor = country.factor;
    } else if (COUNTRY_TABLE.region[anchor]?.[region] !== undefined) {
      basis = 'region';
      countryFactor = COUNTRY_TABLE.region[anchor][region];
    } else {
      basis = 'global';
      countryFactor = COUNTRY_TABLE.global[anchor];
    }
    const modelFactor = modelAdjustment.factors[anchor] ?? 1;
    // The reference model keeps the country factor exactly, so its stored estimates are unchanged.
    const factor = modelFactor === 1 ? countryFactor : Math.round(countryFactor * modelFactor * 1e4) / 1e4;
    anchors[anchor] = { factor, basis, countryFactor, modelFactor };
  }

  return {
    version: cityCostV12CorrectionVersionFor(model),
    fittedFor: COUNTRY_TABLE.fittedOn.model,
    fittedForModel: model ? modelAdjustment.basis !== 'default' : null,
    modelAdjustment,
    countryCode,
    region,
    anchors,
  };
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
