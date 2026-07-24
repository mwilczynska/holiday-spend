import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const datasetPath = path.resolve(process.cwd(), 'data', 'reference', 'city_costs_app_aud.csv');
const outputPath = path.resolve(process.cwd(), 'data', 'reference', 'city_cost_collection_pilot.json');

const regionQuotas = {
  SEA: 11,
  Europe: 7,
  'East Asia': 5,
  'Latin America': 3,
  Oceania: 2,
  'North America': 2,
  'South Asia': 2,
  Africa: 2,
  'Middle East': 2,
};

const requiredCities = new Map([
  ['Hanoi|Vietnam', 'baseline_audit_recheck'],
  ['Lisbon|Portugal', 'baseline_audit_recheck'],
  ['Prague|Czech Republic', 'baseline_audit_recheck'],
  ['Pu Luong|Vietnam', 'sparse_city_stress_test'],
  ['Don Det|Laos', 'sparse_city_stress_test'],
  ['Santa Fe (Bantayan)|Philippines', 'sparse_city_stress_test'],
]);

function parseMoney(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function rowKey(row) {
  return `${row.city}|${row.country}`;
}

const parsed = Papa.parse(fs.readFileSync(datasetPath, 'utf8'), { header: true, skipEmptyLines: true });
if (parsed.errors.length) throw new Error(parsed.errors[0].message);

const cities = parsed.data.map((row) => ({
  city: row.city,
  country: row.country,
  region: row.region,
  currentMidBasketAud:
    parseMoney(row.accom_3_star, 'accom_3_star') +
    parseMoney(row.food_mid_range, 'food_mid_range') +
    parseMoney(row.drinks_moderate, 'drinks_moderate') +
    parseMoney(row.activities_mid_range, 'activities_mid_range'),
}));

const rankedGlobally = [...cities].sort((a, b) =>
  a.currentMidBasketAud - b.currentMidBasketAud || rowKey(a).localeCompare(rowKey(b))
);
const quartileByCity = new Map(
  rankedGlobally.map((city, index) => [rowKey(city), Math.min(4, Math.floor((index / rankedGlobally.length) * 4) + 1)])
);

function targetQuantiles(quota) {
  if (quota === 1) return [0.5];
  if (quota === 2) return [0.25, 0.75];
  return Array.from({ length: quota }, (_, index) => (index + 0.5) / quota);
}

function selectRegion(region, quota) {
  const regionCities = cities
    .filter((city) => city.region === region)
    .sort((a, b) => a.currentMidBasketAud - b.currentMidBasketAud || rowKey(a).localeCompare(rowKey(b)));
  if (regionCities.length < quota) throw new Error(`${region} has fewer cities than its quota`);

  const selected = new Map();
  for (const city of regionCities) {
    const reason = requiredCities.get(rowKey(city));
    if (reason) selected.set(rowKey(city), { ...city, selectionReason: reason });
  }
  if (selected.size > quota) throw new Error(`${region} has more required cities than its quota`);

  for (const target of targetQuantiles(quota)) {
    if (selected.size >= quota) break;
    const candidate = regionCities
      .filter((city) => !selected.has(rowKey(city)))
      .map((city, index) => {
        const originalIndex = regionCities.findIndex((entry) => rowKey(entry) === rowKey(city));
        const quantile = (originalIndex + 0.5) / regionCities.length;
        return { city, distance: Math.abs(quantile - target), index };
      })
      .sort((a, b) => a.distance - b.distance || a.city.currentMidBasketAud - b.city.currentMidBasketAud)[0]?.city;
    if (candidate) selected.set(rowKey(candidate), { ...candidate, selectionReason: 'regional_cost_quantile' });
  }

  for (const city of regionCities) {
    if (selected.size >= quota) break;
    if (!selected.has(rowKey(city))) selected.set(rowKey(city), { ...city, selectionReason: 'quota_fill' });
  }

  return [...selected.values()];
}

const selection = Object.entries(regionQuotas)
  .flatMap(([region, quota]) => selectRegion(region, quota))
  .map((city) => ({
    ...city,
    currentMidBasketAud: Number(city.currentMidBasketAud.toFixed(2)),
    currentCostQuartile: quartileByCity.get(rowKey(city)),
  }))
  .sort((a, b) => a.region.localeCompare(b.region) || a.currentMidBasketAud - b.currentMidBasketAud);

const manifest = {
  schemaVersion: 'city-cost-pilot-v1',
  sourceDataset: 'data/reference/city_costs_app_aud.csv',
  selectionAlgorithm: 'regional quotas with deterministic current-mid-basket quantile coverage',
  currentMidBasketFormula: 'accom_3_star + food_mid_range + drinks_moderate + activities_mid_range',
  status: 'candidate_until_city_size_tourism_intensity_and_source_density_features_are_added',
  targetCities: selection.length,
  regionQuotas,
  requiredCityReasons: Object.fromEntries(requiredCities),
  cities: selection,
};

if (process.argv.includes('--write')) {
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)} with ${selection.length} cities.`);
} else {
  console.log(JSON.stringify(manifest, null, 2));
}
