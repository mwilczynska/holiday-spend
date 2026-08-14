import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildV61PlannerMetadata,
  resolvePlannerCityMetadataForGeneration,
} from './planner-city-resolution';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';

vi.mock('@/lib/city-llm-client', () => ({
  runJsonPromptWithProvider: vi.fn(),
}));

const mockedRunJsonPromptWithProvider = vi.mocked(runJsonPromptWithProvider);

afterEach(() => {
  delete process.env.CITY_COST_METHODOLOGY_V6;
  mockedRunJsonPromptWithProvider.mockReset();
});

describe('planner city metadata boundary', () => {
  it('uses deterministic requested identity for v6.1 without a metadata LLM call', async () => {
    process.env.CITY_COST_METHODOLOGY_V6 = 'true';

    const input = {
      cityName: '  Matsuyama  ',
      countryName: ' Japan ',
    };

    await expect(resolvePlannerCityMetadataForGeneration(input)).resolves.toEqual(
      buildV61PlannerMetadata(input),
    );
    expect(mockedRunJsonPromptWithProvider).not.toHaveBeenCalled();
  });

  it('retains the legacy metadata provider call when v6.1 is disabled', async () => {
    mockedRunJsonPromptWithProvider.mockResolvedValue({
      provider: 'openai',
      model: 'test-model',
      text: JSON.stringify({
        city: 'Matsuyama',
        country: 'Japan',
        confidence_notes: 'test',
      }),
    });

    await expect(resolvePlannerCityMetadataForGeneration({
      cityName: 'Matsuyama',
      countryName: 'Japan',
      provider: 'openai',
      apiKey: 'test',
    })).resolves.toMatchObject({ city: 'Matsuyama', country: 'Japan' });
    expect(mockedRunJsonPromptWithProvider).toHaveBeenCalledTimes(1);
  });
});
