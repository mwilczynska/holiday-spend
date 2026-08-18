import { describe, expect, it } from 'vitest';
import { materializeCityCostV11 } from '@/lib/city-cost-methodology-v1-1';
import type { CityGenerationResult, GeneratedCityPayload } from '@/lib/city-generation';
import { buildCityEstimatePersistence } from '@/lib/city-generation-persistence';

const anchorValues = {
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

function v11Result(): CityGenerationResult {
  const payload = {
    region: 'East Asia' as const,
    confidence: 'medium' as const,
    confidence_notes: 'Holistic fixture.',
    comparable_city_reasoning: 'Comparable fixture.',
    anchors_usd: anchorValues,
  };
  return {
    methodologyVersion: 'v1.1',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    promptVersion: 'llm_prompt_new_cities_v1_1.md',
    reasoningEffort: 'max',
    payload,
    mappedEstimate: materializeCityCostV11(payload).mappedEstimate,
    inferredAudPerUsd: materializeCityCostV11(payload).fx.audPerUsd,
    v11Materialization: materializeCityCostV11(payload),
  };
}

describe('city-generation-persistence', () => {
  it('keeps the historical v1 source and shape distinct', () => {
    const payload = {
      city: 'Fixture City',
      country: 'Fixtureland',
      region: 'Europe',
      confidence: 'medium',
      confidence_notes: 'v1 fixture',
      anchors_usd: { beer: 2 },
      tiers_aud: { food_budget: 20 },
    } as unknown as GeneratedCityPayload;
    const result = {
      methodologyVersion: 'v1',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      promptVersion: 'llm_prompt_new_cities_1.md',
      payload,
      mappedEstimate: { foodBudget: 20 },
      inferredAudPerUsd: 1.43,
    } as CityGenerationResult;

    const persisted = buildCityEstimatePersistence(result, { cityName: 'Fixture City', countryName: 'Fixtureland' });
    expect(persisted.estimateSource).toBe('llm_city_generation');
    expect(persisted.metadata.methodologyVersion).toBe('v1');
    expect(persisted.metadata.evidenceBasis).toBeNull();
  });

  it('persists v1.1 anchors, formula, FX, reasoning and explicit holistic basis', () => {
    const persisted = buildCityEstimatePersistence(v11Result(), {
      cityName: 'Toyama',
      countryName: 'Japan',
      referenceDate: '2026-09-17',
      extraContext: 'fixture context',
    });

    expect(persisted.estimateSource).toBe('llm_city_generation_v1_1');
    expect(persisted.metadata).toMatchObject({
      methodologyVersion: 'v1.1',
      evidenceBasis: 'holistic_model_estimate',
      formulaVersion: 'v1-formulas-preserved-v1.1',
      reasoningEffort: 'max',
    });
    expect(persisted.anchors).toMatchObject({ currency: 'USD', convertedCurrency: 'AUD' });
    expect(persisted.inputSnapshot).toMatchObject({ cityName: 'Toyama', countryName: 'Japan' });
    expect(persisted.apiSummary.fx).toMatchObject({ snapshotId: 'aud-reference-2026-07-22-v1' });
    expect(persisted.metadata.evidenceGrades).toBeNull();
    expect(persisted.metadata.intervals).toBeNull();
  });
});

