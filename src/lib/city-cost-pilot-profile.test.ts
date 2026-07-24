import { describe, expect, it } from 'vitest';
import { buildCityCostPilotProfile } from './city-cost-pilot-profile';

describe('city cost pilot profile', () => {
  it('keeps zero-evidence pilot cities in coverage denominators', () => {
    const enrichment = { enrichmentId: 'test', cities: [
      { city: 'A', country: 'X', region: 'R', citySize: { status: 'measured_from_public_source', band: 'small' }, tourismIntensity: { status: 'pending', band: 'unknown' }, publicSourceDensity: { band: 'sparse' } },
      { city: 'B', country: 'X', region: 'R', citySize: { status: 'pending', band: 'unknown' }, tourismIntensity: { status: 'pending', band: 'unknown' }, publicSourceDensity: { band: 'none' } },
    ] };
    const tiersAud: Record<string, { amountAud: number | null }> = Object.fromEntries(Array.from({ length: 19 }, (_, index) => [`tier-${index}`, { amountAud: null }]));
    tiersAud.drink_coffee = { amountAud: 4 };
    const profile = buildCityCostPilotProfile(enrichment, {
      calculatorVersion: 'test', dataCutoff: '2026-01-01', qualitySummary: {},
      cities: [{ city: 'A', country: 'X', tiersAud, complete: false }],
    });
    expect(profile.pilotCityCount).toBe(2);
    expect(profile.representedCityCount).toBe(1);
    expect(profile.requiredTierCells).toBe(38);
    expect(profile.tierCoverage.drink_coffee).toEqual({ materializedCityCount: 1, missingCityCount: 1, coveragePct: 50 });
  });
});
