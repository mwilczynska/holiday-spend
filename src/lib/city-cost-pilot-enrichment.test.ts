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
    expect(artifact.cities.filter((city) => city.tourismIntensity.status === 'measured_from_public_sources')).toHaveLength(12);
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
    expect(artifact.cities.find((city) => city.city === 'Fukuoka')?.tourismIntensity).toMatchObject({
      overnightArrivals: 5_760_000,
      residentPopulation: 1_642_571,
      band: 'medium',
    });
    expect(artifact.cities.find((city) => city.city === 'Budapest')?.tourismIntensity).toMatchObject({
      overnightArrivals: 6_730_727,
      residentPopulation: 1_686_222,
      band: 'medium',
    });
    expect(artifact.cities.find((city) => city.city === 'Sofia')?.tourismIntensity).toMatchObject({
      overnightArrivals: 1_185_345,
      residentPopulation: 1_295_931,
      band: 'low',
    });
    expect(artifact.cities.find((city) => city.city === 'Istanbul')?.tourismIntensity).toMatchObject({
      overnightArrivals: 13_212_666,
      residentPopulation: 15_655_924,
      band: 'low',
    });
    expect(artifact.cities.find((city) => city.city === 'Dubrovnik')?.tourismIntensity).toMatchObject({
      overnightArrivals: 1_397_052,
      residentPopulation: 42_016,
      band: 'very_high',
    });
    expect(artifact.cities.find((city) => city.city === 'Split')?.tourismIntensity).toMatchObject({
      overnightArrivals: 1_050_847,
      residentPopulation: 158_636,
      band: 'high',
    });
    expect(artifact.cities.find((city) => city.city === 'San Francisco')?.tourismIntensity).toMatchObject({
      overnightArrivals: 8_000_000,
      residentPopulation: 808_988,
      band: 'high',
    });
    expect(artifact.cities.find((city) => city.city === 'Lisbon')?.tourismIntensity).toMatchObject({
      overnightArrivals: 6_460_430,
      residentPopulation: 567_131,
      band: 'high',
    });
    expect(artifact.cities.find((city) => city.city === 'Vancouver')?.tourismIntensity).toMatchObject({
      overnightArrivals: 11_271_967,
      residentPopulation: 748_777,
      band: 'very_high',
    });
    expect(artifact.cities.find((city) => city.city === 'Queenstown')?.tourismIntensity).toMatchObject({
      status: 'pending_source_collection',
      value: null,
      band: 'unknown',
      researchOutcome: 'screened_no_compatible_value',
      rejectionReason: 'incompatible_numerator',
      screenedSources: [
        { name: expect.stringContaining('Queenstown Lakes District Council'), url: expect.stringContaining('qldc.govt.nz') },
        { name: expect.stringContaining('Population and Demand'), url: expect.stringContaining('qldc.govt.nz') },
      ],
    });
    expect(artifact.cities.find((city) => city.city === 'Queenstown')?.tourismIntensity.notes).toContain(
      'reports 4.5 million guest nights'
    );
    expect(artifact.cities.find((city) => city.city === 'Auckland')?.tourismIntensity).toMatchObject({
      status: 'pending_source_collection',
      researchOutcome: 'not_yet_screened',
      rejectionReason: null,
      screenedSources: [],
    });
  });
});
