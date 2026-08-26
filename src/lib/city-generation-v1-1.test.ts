import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCityGenerationV11Prompt,
  getCityCostMethodologyVersion,
} from '@/lib/city-generation';

const originalVersion = process.env.CITY_COST_METHODOLOGY_VERSION;
const originalLegacyFlag = process.env.CITY_COST_METHODOLOGY_V6;

afterEach(() => {
  if (originalVersion === undefined) delete process.env.CITY_COST_METHODOLOGY_VERSION;
  else process.env.CITY_COST_METHODOLOGY_VERSION = originalVersion;
  if (originalLegacyFlag === undefined) delete process.env.CITY_COST_METHODOLOGY_V6;
  else process.env.CITY_COST_METHODOLOGY_V6 = originalLegacyFlag;
});

describe('v1.1 city generation dispatch', () => {
  it('defaults to v1.1 after the owner-authorized activation', () => {
    delete process.env.CITY_COST_METHODOLOGY_VERSION;
    delete process.env.CITY_COST_METHODOLOGY_V6;
    expect(getCityCostMethodologyVersion()).toBe('v1.1');
  });

  it('retains explicit v1 rollback', () => {
    process.env.CITY_COST_METHODOLOGY_VERSION = 'v1';
    delete process.env.CITY_COST_METHODOLOGY_V6;
    expect(getCityCostMethodologyVersion()).toBe('v1');
  });

  it('selects v1.1 only when explicitly configured', () => {
    process.env.CITY_COST_METHODOLOGY_VERSION = 'v1.1';
    delete process.env.CITY_COST_METHODOLOGY_V6;
    expect(getCityCostMethodologyVersion()).toBe('v1.1');
  });

  it('refuses the retired v6 activation flag', () => {
    process.env.CITY_COST_METHODOLOGY_V6 = 'true';
    expect(() => getCityCostMethodologyVersion()).toThrow(/v6 is retired/i);
  });

  it('builds an anchor-only prompt with server-owned identity and no derived tiers', () => {
    const { prompt, promptVersion } = buildCityGenerationV11Prompt({
      cityName: 'Toyama',
      countryName: 'Japan',
      referenceDate: '2026-09-17',
      extraContext: 'A compact regional city.',
    });

    expect(promptVersion).toBe('llm_prompt_new_cities_v1_1.md');
    expect(prompt).toContain('- City: Toyama');
    expect(prompt).toContain('- Country: Japan');
    expect(prompt).toContain('A compact regional city.');
    expect(prompt).toContain('Return USD anchors plus only the source FX observation');
    expect(prompt).toContain('latest published Reserve Bank of Australia USD/AUD');
    expect(prompt).toContain('Do not return city or country fields');
    expect(prompt).not.toContain('"tiers_aud"');
  });
});

