import corrections from '@/lib/data/city-cost-corrections-v1-2.json';
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
export const CITY_COST_V12_CORRECTION_VERSION: string = corrections.version;

type AnchorKey = keyof CityCostV11AnchorsUsd;
type CountryFactor = { factor: number; cities: number; region: string };
type CorrectionTable = {
  version: string;
  correctedAnchors: string[];
  global: Record<string, number>;
  region: Record<string, Record<string, number>>;
  country: Record<string, Record<string, CountryFactor>>;
};

const TABLE = corrections as unknown as CorrectionTable;

export type CityCostV12CorrectionBasis = 'country' | 'region' | 'global' | 'none';

export interface CityCostV12AnchorCorrection {
  factor: number;
  basis: CityCostV12CorrectionBasis;
}

export interface CityCostV12Correction {
  version: string;
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
export function resolveCityCostV12Correction(countryName: string, region: string): CityCostV12Correction {
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

  return { version: TABLE.version, countryCode, region, anchors };
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
  context: { countryName: string },
  now = new Date()
): CityCostV12Materialization {
  const parsed: CityCostV11AnchorResponse = cityCostV11AnchorResponseSchema.parse(input);
  const correction = resolveCityCostV12Correction(context.countryName, parsed.region);
  const corrected = applyCityCostV12Correction(parsed.anchors_usd, correction);
  const base = materializeCityCostV11({ ...parsed, anchors_usd: corrected }, now);

  return {
    ...base,
    methodologyVersion: CITY_COST_V12_METHODOLOGY_VERSION,
    rawAnchorsUsd: parsed.anchors_usd,
    correction,
  };
}
