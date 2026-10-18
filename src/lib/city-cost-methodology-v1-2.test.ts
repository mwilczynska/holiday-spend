import { afterEach, describe, expect, it } from 'vitest';
import corrections from '@/lib/data/city-cost-corrections-v1-2.json';
import { materializeCityCostV11 } from '@/lib/city-cost-methodology-v1-1';
import {
  CITY_COST_V12_CORRECTION_VERSION,
  CITY_COST_V12_METHODOLOGY_VERSION,
  materializeCityCostV12,
  resolveCityCostV12Correction,
} from '@/lib/city-cost-methodology-v1-2';
import {
  buildCityGenerationAnchorPrompt,
  getCityCostMethodologyVersion,
  type CityGenerationResult,
} from '@/lib/city-generation';
import { buildCityEstimatePersistence } from '@/lib/city-generation-persistence';
import { readCityEstimateProvenance } from '@/lib/city-estimate-provenance';

const anchors = {
  beer: 2,
  coffee: 3,
  inexp_meal_1p: 10,
  midrange_meal_2p: 40,
  cocktail: 8,
  wine_glass: 6,
  hostel_dorm_1p: 12,
  hostel_private_2p: 30,
  hotel_1star_2p: 50,
  hotel_3star_2p: 100,
};

const response = {
  region: 'Europe' as const,
  confidence: 'medium' as const,
  confidence_notes: 'Fixture.',
  comparable_city_reasoning: 'Fixture.',
  fx: {
    as_of_date: '2026-10-16',
    source_name: 'Reserve Bank of Australia' as const,
    source_url: 'https://www.rba.gov.au/statistics/frequency/exchange-rates.html',
    source_rate: 0.6955,
    source_rate_basis: 'USD_PER_AUD' as const,
  },
  anchors_usd: anchors,
};

const now = new Date('2026-10-18T00:00:00Z');
const originalVersion = process.env.CITY_COST_METHODOLOGY_VERSION;

afterEach(() => {
  if (originalVersion === undefined) delete process.env.CITY_COST_METHODOLOGY_VERSION;
  else process.env.CITY_COST_METHODOLOGY_VERSION = originalVersion;
});

describe('city-cost methodology v1.2', () => {
  it('is the default and keeps v1.1 and v1 as explicit rollbacks', () => {
    delete process.env.CITY_COST_METHODOLOGY_VERSION;
    expect(getCityCostMethodologyVersion()).toBe('v1.2');
    process.env.CITY_COST_METHODOLOGY_VERSION = 'v1.1';
    expect(getCityCostMethodologyVersion()).toBe('v1.1');
    process.env.CITY_COST_METHODOLOGY_VERSION = 'v1';
    expect(getCityCostMethodologyVersion()).toBe('v1');
  });

  it('builds the v1.2 prompt: food and drink search allowed, accommodation stays holistic', () => {
    const { prompt, promptVersion } = buildCityGenerationAnchorPrompt({ cityName: 'Toyama', countryName: 'Japan' }, 'v1.2');
    expect(promptVersion).toBe('llm_prompt_new_cities_v1_2.md');
    expect(prompt).toContain('- City: Toyama');
    expect(prompt).toContain('Use at most six web searches in total');
    expect(prompt).toContain('Do not search for accommodation prices.');
    expect(prompt).toContain('Return USD anchors plus only the source FX observation');
    expect(prompt).not.toContain('Do\nnot use web search to source the city-price anchors');
  });

  it('corrects food, drink, 3-star and 1-star; leaves hostels, cocktail and wine unchanged', () => {
    const correction = resolveCityCostV12Correction('Japan', 'East Asia');
    expect(correction.version).toBe(CITY_COST_V12_CORRECTION_VERSION);
    expect(correction.countryCode).toBe('JP');
    for (const anchor of ['inexp_meal_1p', 'midrange_meal_2p', 'beer', 'coffee', 'hotel_3star_2p', 'hotel_1star_2p'] as const) {
      expect(correction.anchors[anchor].basis).toBe('country');
      expect(correction.anchors[anchor].factor).toBe(corrections.country[anchor].JP.factor);
    }
    for (const anchor of ['hostel_dorm_1p', 'hostel_private_2p', 'cocktail', 'wine_glass'] as const) {
      expect(correction.anchors[anchor]).toEqual({ factor: 1, basis: 'none' });
    }
  });

  it('falls back to the region factor for a country without reference cities, then the global factor', () => {
    const luxembourg = resolveCityCostV12Correction('Luxembourg', 'Europe');
    expect(luxembourg.countryCode).toBe('LU');
    expect(luxembourg.anchors.hotel_3star_2p.basis).toBe('region');
    expect(luxembourg.anchors.hotel_3star_2p.factor).toBe(corrections.region.hotel_3star_2p.Europe);

    const unknownRegion = resolveCityCostV12Correction('Nowhereland', 'Atlantis');
    expect(unknownRegion.countryCode).toBeNull();
    expect(unknownRegion.anchors.hotel_3star_2p).toEqual({ factor: corrections.global.hotel_3star_2p, basis: 'global' });
  });

  it('materializes corrected anchors with the unchanged v1 formulas, so 4-star follows the corrected 3-star', () => {
    const materialized = materializeCityCostV12(response, { countryName: 'Italy' }, now);
    const factor = (anchor: string) => materialized.correction.anchors[anchor as keyof typeof anchors].factor;

    expect(materialized.methodologyVersion).toBe(CITY_COST_V12_METHODOLOGY_VERSION);
    expect(materialized.rawAnchorsUsd).toEqual(anchors);
    expect(materialized.anchorsUsd.hotel_3star_2p).toBe(Math.round(100 * factor('hotel_3star_2p') * 100) / 100);
    expect(materialized.anchorsUsd.hostel_dorm_1p).toBe(12);
    expect(materialized.tiersUsd.accom_4_star).toBeCloseTo(materialized.anchorsUsd.hotel_3star_2p * 1.8, 6);

    const reference = materializeCityCostV11({ ...response, anchors_usd: materialized.anchorsUsd }, now);
    expect(materialized.tiersAud).toEqual(reference.tiersAud);
    expect(materialized.fx).toEqual(reference.fx);
  });

  it('persists the raw anchors, the correction and a v1.2 source label', () => {
    const v12 = materializeCityCostV12(response, { countryName: 'Italy' }, now);
    const result: CityGenerationResult = {
      methodologyVersion: 'v1.2',
      provider: 'openai',
      model: 'gpt-6-luna',
      promptVersion: 'llm_prompt_new_cities_v1_2.md',
      reasoningEffort: 'max',
      payload: response,
      mappedEstimate: v12.mappedEstimate,
      inferredAudPerUsd: v12.fx.audPerUsd,
      v11Materialization: v12,
    };
    const persisted = buildCityEstimatePersistence(result, { cityName: 'Bologna', countryName: 'Italy' });

    expect(persisted.estimateSource).toBe('llm_city_generation_v1_2');
    expect(persisted.metadata.methodologyVersion).toBe('v1.2');
    expect(persisted.anchors).toMatchObject({ values: v12.anchorsUsd, rawValues: anchors, correction: v12.correction });
    expect(persisted.apiSummary.methodologyVersion).toBe('v1.2');
    expect(readCityEstimateProvenance({ source: 'llm_city_generation_v1_2', sourcesJson: '{}' })?.methodologyVersion).toBe('v1.2');
  });
});
