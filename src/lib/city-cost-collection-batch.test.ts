import { describe, expect, it } from 'vitest';
import { cityCostCollectionManifestSchema } from './city-cost-collection-batch';

function manifestFixture() {
  return {
    schemaVersion: 'city-cost-collection-batches-v1' as const,
    collectionPolicy: 'free_llm_web_research_only' as const,
    callLimitPolicy: 'provider_free_tier_only' as const,
    projectDailyCallCap: null,
    checkpointAfterEveryCity: true,
    researchPrompt: 'docs/prompts/llm_prompt_city_cost_observations_1.md',
    observationSchema: 'city-cost-observation-v1' as const,
    batches: [
      {
        batchId: 'batch-001',
        status: 'complete_with_missing' as const,
        plannedCalls: 2,
        completedCalls: 2,
        acceptedObservations: 4,
        checkpoint: 'food_complete',
        observationFiles: ['data/reference/observations/batch-001.jsonl'],
        reportFile: 'data/reference/observations/batch-001-report.json',
        cities: [
          {
            city: 'Hanoi',
            country: 'Vietnam',
            region: 'SEA' as const,
            categories: ['food_drinks' as const],
            reason: 'pilot',
          },
        ],
      },
    ],
  };
}

describe('city cost collection manifest schema', () => {
  it('accepts a completed free-only batch', () => {
    const parsed = cityCostCollectionManifestSchema.parse(manifestFixture());
    expect(parsed.projectDailyCallCap).toBeNull();
    expect(parsed.batches[0].acceptedObservations).toBe(4);
  });

  it('rejects a project-imposed daily call cap', () => {
    const result = cityCostCollectionManifestSchema.safeParse({ ...manifestFixture(), projectDailyCallCap: 12 });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate batch identifiers', () => {
    const fixture = manifestFixture();
    const result = cityCostCollectionManifestSchema.safeParse({
      ...fixture,
      batches: [fixture.batches[0], { ...fixture.batches[0] }],
    });
    expect(result.success).toBe(false);
  });

  it('requires completed batches to account for every planned call', () => {
    const fixture = manifestFixture();
    const result = cityCostCollectionManifestSchema.safeParse({
      ...fixture,
      batches: [{ ...fixture.batches[0], completedCalls: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('requires blocked batches to explain the blocking condition', () => {
    const fixture = manifestFixture();
    const result = cityCostCollectionManifestSchema.safeParse({
      ...fixture,
      batches: [
        {
          batchId: 'accommodation',
          status: 'blocked_on_reference_window_design',
          plannedCalls: 0,
          cities: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
