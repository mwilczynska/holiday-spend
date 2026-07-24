import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cityCostPilotEnrichmentSchema, sourceDensityBand } from './city-cost-pilot-enrichment';

describe('city cost pilot enrichment', () => {
  it('uses frozen evidence-density thresholds', () => {
    expect([0, 1, 2, 3, 5, 6].map(sourceDensityBand)).toEqual([
      'none', 'sparse', 'sparse', 'moderate', 'moderate', 'dense',
    ]);
  });

  it('contains each of the 36 pilot candidates exactly once', () => {
    const artifact = cityCostPilotEnrichmentSchema.parse(JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'data/reference/city_cost_pilot_enrichment.json'), 'utf8'
    )));
    expect(artifact.cities).toHaveLength(36);
    expect(new Set(artifact.cities.map((city) => `${city.city}|${city.country}`)).size).toBe(36);
    expect(artifact.cities.find((city) => city.city === 'Dubai')?.publicSourceDensity.band).toBe('moderate');
  });
});
