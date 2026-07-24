import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cityCostPilotEnrichmentSchema, citySizeBand, sourceDensityBand, tourismIntensityBand } from './city-cost-pilot-enrichment';

describe('city cost pilot enrichment', () => {
  it('uses frozen evidence-density thresholds', () => {
    expect([0, 1, 2, 3, 5, 6].map(sourceDensityBand)).toEqual([
      'none', 'sparse', 'sparse', 'moderate', 'moderate', 'dense',
    ]);
  });

  it('uses frozen city-size thresholds', () => {
    expect([99_999, 100_000, 499_999, 500_000, 4_999_999, 5_000_000].map(citySizeBand)).toEqual([
      'small', 'medium', 'medium', 'large', 'large', 'megacity',
    ]);
  });

  it('uses frozen tourism-intensity thresholds', () => {
    expect([0.99, 1, 4.99, 5, 14.99, 15].map(tourismIntensityBand)).toEqual([
      'low', 'medium', 'medium', 'high', 'high', 'very_high',
    ]);
  });

  it('contains each of the 36 pilot candidates exactly once', () => {
    const artifact = cityCostPilotEnrichmentSchema.parse(JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'data/reference/city_cost_pilot_enrichment.json'), 'utf8'
    )));
    expect(artifact.cities).toHaveLength(36);
    expect(new Set(artifact.cities.map((city) => `${city.city}|${city.country}`)).size).toBe(36);
    expect(artifact.cities.find((city) => city.city === 'Dubai')?.publicSourceDensity.band).toBe('moderate');
    expect(artifact.cities.filter((city) => city.citySize.status === 'measured_from_public_source')).toHaveLength(29);
    expect(artifact.cities.filter((city) => city.citySize.status === 'pending_source_collection')).toHaveLength(7);
    expect(artifact.cities.find((city) => city.city === 'Tokyo')?.citySize).toMatchObject({
      value: 33_412_512,
      band: 'megacity',
      sourceRecordId: '6030',
    });
    expect(artifact.cities.find((city) => city.city === 'Yangon')?.citySize).toMatchObject({
      value: 5_618_303,
      sourceRecordId: '5433',
    });
    expect(artifact.cities.find((city) => city.city === 'Goa')?.citySize.notes).toContain('state and multi-city');
    expect(artifact.cities.filter((city) => city.tourismIntensity.status === 'measured_from_public_sources')).toHaveLength(3);
    expect(artifact.cities.find((city) => city.city === 'Prague')?.tourismIntensity).toMatchObject({
      overnightArrivals: 8_063_367,
      residentPopulation: 1_397_880,
      band: 'high',
    });
    expect(artifact.cities.find((city) => city.city === 'Barcelona')?.tourismIntensity).toMatchObject({
      overnightArrivals: 12_726_360,
      residentPopulation: 1_702_814,
      band: 'high',
    });
    expect(artifact.cities.find((city) => city.city === 'Mexico City')?.tourismIntensity).toMatchObject({
      overnightArrivals: 14_403_349,
      residentPopulation: 9_221_637,
      band: 'medium',
    });
  });
});
