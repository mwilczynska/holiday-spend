import { describe, expect, it } from 'vitest';
import { readCityEstimateProvenance } from '@/lib/city-estimate-provenance';

describe('city-estimate-provenance', () => {
  it('reads v1.1 provenance without inventing grades or intervals', () => {
    const result = readCityEstimateProvenance({
      source: 'llm_city_generation_v1_1',
      provider: 'openai',
      model: 'gpt-5.6-luna',
      promptVersion: 'llm_prompt_new_cities_v1_1.md',
      confidence: 'medium',
      metadataJson: JSON.stringify({
        methodologyVersion: 'v1.1',
        evidenceBasis: 'holistic_model_estimate',
        formulaVersion: 'v1-formulas-preserved-v1.1',
        reasoningEffort: 'max',
        confidenceNotes: 'fixture',
        fx: { snapshotId: 'fixture' },
      }),
      anchorsJson: JSON.stringify({ currency: 'USD', values: { beer: 2 } }),
      inputSnapshotJson: JSON.stringify({ cityName: 'Toyama' }),
      sourcesJson: JSON.stringify({ foodBudget: 'llm_city_generation_v1_1' }),
    });

    expect(result).toMatchObject({
      methodologyVersion: 'v1.1',
      evidenceBasis: 'holistic_model_estimate',
      formulaVersion: 'v1-formulas-preserved-v1.1',
      reasoningEffort: 'max',
      anchors: { currency: 'USD' },
    });
    expect(result?.evidenceGrades).toBeNull();
    expect(result?.intervals).toBeNull();
  });

  it('keeps historical v6 versions readable from their source/metadata shape', () => {
    const result = readCityEstimateProvenance({
      source: 'llm_city_generation_v6_1',
      metadataJson: JSON.stringify({
        methodologyVersion: 'v6.1',
        evidenceGrades: { accom_3_star: 'B' },
        intervals: { accom_3_star: { widthPct: 20 } },
        v6CollectionTelemetry: [{ source: 'expedia_3star' }],
        v6Missingness: { cocktail_1: 'not_found' },
        v6PriorBasis: 'global',
      }),
      anchorsJson: JSON.stringify([{ measure: 'hotel_3star_room_2p' }]),
      inputSnapshotJson: JSON.stringify({ hotel_3star_room_2p: 100 }),
      sourcesJson: JSON.stringify({ accom3star: 'v6.1-fixture' }),
    });

    expect(result?.methodologyVersion).toBe('v6.1');
    expect(result?.evidenceGrades).toEqual({ accom_3_star: 'B' });
    expect(result?.collectionTelemetry).toEqual([{ source: 'expedia_3star' }]);
    expect(result?.missingness).toEqual({ cocktail_1: 'not_found' });
    expect(result?.priorBasis).toBe('global');
  });

  it('fails closed to no provenance for completely empty records', () => {
    expect(readCityEstimateProvenance({})).toBeNull();
    expect(readCityEstimateProvenance({ metadataJson: '{not-json' })).toBeNull();
  });
});
