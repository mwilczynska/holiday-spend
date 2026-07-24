import fs from 'node:fs';
import path from 'node:path';
import { cityCostCollectionManifestSchema } from '../src/lib/city-cost-collection-batch';
import { cityCostObservationSchema } from '../src/lib/city-cost-observation';
import {
  cityCostPilotEnrichmentSchema,
  citySizeBand,
  sourceDensityBand,
} from '../src/lib/city-cost-pilot-enrichment';

const root = process.cwd();
const pilotPath = path.join(root, 'data/reference/city_cost_collection_pilot.json');
const manifestPath = path.join(root, 'data/reference/city_cost_collection_batches.json');
const outputPath = path.join(root, 'data/reference/city_cost_pilot_enrichment.json');
const inputsPath = path.join(root, 'data/reference/city_cost_pilot_enrichment_inputs.json');
const check = process.argv.includes('--check');
const evidenceCountryAliases: Record<string, string> = {
  UAE: 'United Arab Emirates',
};

const pilot = JSON.parse(fs.readFileSync(pilotPath, 'utf8')) as {
  cities: Array<{ city: string; country: string; region: string }>;
};
const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8')) as {
  schemaVersion: string;
  source: { name: string; url: string; spatialUnit: 'DEGURBA_city'; referenceYear: number; rawUnit: string };
  citySize: Array<{ city: string; country: string; value: number; sourceRecordId: string; sourceLocation: string }>;
  unmatchedCitySize: Array<{ city: string; country: string; reason: 'no_matching_named_record' | 'destination_is_not_single_city'; notes: string }>;
};
if (inputs.schemaVersion !== 'city-cost-pilot-enrichment-inputs-v2') {
  throw new Error(`Unsupported enrichment inputs schema: ${inputs.schemaVersion}`);
}
const pilotKeys = new Set(pilot.cities.map((city) => `${city.city}|${city.country}`));
const citySizeInputs = new Map(inputs.citySize.map((row) => [`${row.city}|${row.country}`, row]));
const unmatchedCitySizeInputs = new Map(inputs.unmatchedCitySize.map((row) => [`${row.city}|${row.country}`, row]));
if (citySizeInputs.size !== inputs.citySize.length) throw new Error('Duplicate city-size enrichment input');
if (unmatchedCitySizeInputs.size !== inputs.unmatchedCitySize.length) throw new Error('Duplicate unmatched city-size input');
for (const key of Array.from(citySizeInputs.keys())) {
  if (!pilotKeys.has(key)) throw new Error(`City-size enrichment input is not in pilot: ${key}`);
  if (unmatchedCitySizeInputs.has(key)) throw new Error(`City-size input is both matched and unmatched: ${key}`);
}
for (const key of Array.from(unmatchedCitySizeInputs.keys())) {
  if (!pilotKeys.has(key)) throw new Error(`Unmatched city-size input is not in pilot: ${key}`);
}
if (citySizeInputs.size + unmatchedCitySizeInputs.size !== pilot.cities.length) {
  throw new Error('Every pilot city must have either a measured WUP value or an explicit unmatched outcome');
}
const manifest = cityCostCollectionManifestSchema.parse(
  JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
);

const retained = manifest.batches.flatMap((batch) =>
  batch.observationFiles.flatMap((relativeFile) =>
    fs.readFileSync(path.join(root, relativeFile), 'utf8').split(/\r?\n/).filter(Boolean).map((line) =>
      cityCostObservationSchema.parse(JSON.parse(line))
    )
  )
).filter((row) => row.reviewerStatus === 'accepted');

const cities = pilot.cities.map((candidate) => {
  const evidenceCountry = evidenceCountryAliases[candidate.country] ?? candidate.country;
  const rows = retained.filter((row) => row.city === candidate.city && row.country === evidenceCountry);
  const measures = Array.from(new Set(rows.map((row) => row.measure))).sort();
  const sources = new Set(rows.map((row) => `${row.sourceName}|${row.sourceUrl}`));
  const categories = Array.from(new Set(rows.map((row) => row.category))).sort() as Array<
    'accommodation' | 'food' | 'drinks' | 'activities'
  >;
  const pendingNotes = 'Pending collection from a named public source; no intuitive or country-level label is permitted.';
  const citySizeInput = citySizeInputs.get(`${candidate.city}|${candidate.country}`);
  const unmatchedCitySizeInput = unmatchedCitySizeInputs.get(`${candidate.city}|${candidate.country}`);
  return {
    city: candidate.city,
    country: candidate.country,
    region: candidate.region,
    citySize: citySizeInput ? {
      status: 'measured_from_public_source' as const,
      value: citySizeInput.value,
      referenceYear: inputs.source.referenceYear,
      spatialUnit: inputs.source.spatialUnit,
      band: citySizeBand(citySizeInput.value),
      sourceName: inputs.source.name,
      sourceUrl: inputs.source.url,
      sourceRecordId: citySizeInput.sourceRecordId,
      sourceLocation: citySizeInput.sourceLocation,
      notes: `Converted the published ${inputs.source.referenceYear} value from ${inputs.source.rawUnit} to integer residents; matched by country and source city label.`,
    } : {
      status: 'pending_source_collection' as const,
      value: null,
      referenceYear: null,
      spatialUnit: null,
      band: 'unknown' as const,
      sourceName: null,
      sourceUrl: null,
      notes: unmatchedCitySizeInput?.notes ?? pendingNotes,
    },
    tourismIntensity: {
      status: 'pending_source_collection' as const,
      value: null,
      referenceYear: null,
      spatialUnit: null,
      band: 'unknown' as const,
      sourceName: null,
      sourceUrl: null,
      notes: pendingNotes,
    },
    publicSourceDensity: {
      status: 'measured_from_retained_evidence' as const,
      acceptedObservationCount: rows.length,
      observedMeasureCount: measures.length,
      distinctSourceCount: sources.size,
      categoriesWithEvidence: categories,
      band: sourceDensityBand(measures.length),
      derivation: `Count accepted retained observations, distinct standardized measures, numeric sources, and represented categories for the exact city-country key. Evidence-country key: ${evidenceCountry}.`,
    },
  };
});

const artifact = cityCostPilotEnrichmentSchema.parse({
  schemaVersion: 'city-cost-pilot-enrichment-v2',
  enrichmentId: 'pilot-36-enrichment-2026-07-24-v2',
  pilotSource: 'data/reference/city_cost_collection_pilot.json',
  observationManifestSource: 'data/reference/city_cost_collection_batches.json',
  generatedAt: '2026-07-24T15:00:00.000Z',
  definitions: {
    citySize: {
      estimand: 'Resident population of the smallest consistently defined city or urban-area geography containing the destination; geography and reference year must be retained.',
      preferredSourceOrder: ['official municipal or national statistics', 'UN World Urbanization Prospects', 'World Bank or other public intergovernmental dataset'],
      bands: { small: '<100,000', medium: '100,000-499,999', large: '500,000-4,999,999', megacity: '>=5,000,000', unknown: 'No comparable public value retained' },
    },
    tourismIntensity: {
      estimand: 'Annual overnight visitor arrivals divided by resident population for the same destination geography and a stated reference year.',
      preferredSourceOrder: ['official destination or municipal statistics', 'official national tourism statistics with destination table', 'public intergovernmental tourism dataset'],
      bands: { low: '<1 visitor per resident', medium: '1-4.99', high: '5-14.99', very_high: '>=15', unknown: 'No comparable public numerator and denominator retained' },
    },
    publicSourceDensity: {
      estimand: 'Number of distinct required measures with accepted numeric evidence in the retained Phase 6 observation store for the exact city-country key.',
      bands: { none: '0 measures', sparse: '1-2 measures', moderate: '3-5 measures', dense: '>=6 measures' },
    },
  },
  cities,
});

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (check) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== serialized) {
    console.error('data/reference/city_cost_pilot_enrichment.json is stale; run npm run methodology:pilot:enrich');
    process.exit(1);
  }
} else {
  fs.writeFileSync(outputPath, serialized);
}

console.log(JSON.stringify({ valid: true, mode: check ? 'check' : 'write', cities: artifact.cities.length,
  sourceDensityBands: Object.fromEntries(['none','sparse','moderate','dense'].map((band) => [band, artifact.cities.filter((city) => city.publicSourceDensity.band === band).length])),
  measuredCitySize: artifact.cities.filter((city) => city.citySize.status === 'measured_from_public_source').length,
  pendingCitySize: artifact.cities.filter((city) => city.citySize.status === 'pending_source_collection').length,
  pendingTourismIntensity: artifact.cities.filter((city) => city.tourismIntensity.status === 'pending_source_collection').length }, null, 2));
