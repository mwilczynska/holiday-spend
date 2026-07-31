// Experiment 000: audit the existing v3/v4 evidence without treating the
// asserted production CSV as ground truth. The output intentionally contains
// no wall-clock timestamp so a rerun can be byte-compared.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'reference', 'v5', 'experiments', '000-baseline-reassessment', 'results.json');

const SAMPLE_FILES = [
  'data/reference/dry-run/phase-0a-numbeo-anchors.json',
  'data/reference/dry-run/phase-0d-numbeo-expanded-sample.json',
  'data/reference/dry-run/phase-0e-stage1-numbeo-sample.json',
  'data/reference/dry-run/phase-0f-stage2-numbeo-sample.json',
];

const DIRECT_MEASURES = [
  'inexpensive_restaurant_meal_1p',
  'midrange_restaurant_meal_2p',
  'mcmeal_combo',
  'domestic_draft_beer_1',
  'cappuccino_1',
  'hostel_dorm_bed_1p',
  'hostel_private_room_2p',
  'hotel_1star_room_2p',
  'hotel_2star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
  'paid_attraction_adult_1',
  'half_day_group_activity_adult_1',
  'full_day_premium_activity_adult_1',
  'street_food_meal_1p',
  'premium_restaurant_meal_2p',
  'cocktail_1',
  'wine_glass_1',
];

const PRODUCT_DEPENDENCIES = {
  accom_shared_hostel_dorm: { basis: 'direct', inputs: ['hostel_dorm_bed_1p'] },
  accom_hostel_private_room: { basis: 'direct', inputs: ['hostel_private_room_2p'] },
  accom_1_star: { basis: 'direct', inputs: ['hotel_1star_room_2p'] },
  accom_2_star: { basis: 'direct', inputs: ['hotel_2star_room_2p'] },
  accom_3_star: { basis: 'direct', inputs: ['hotel_3star_room_2p'] },
  accom_4_star: { basis: 'direct', inputs: ['hotel_4star_room_2p'] },
  food_street_food: { basis: 'v4_proxy_model', inputs: ['mcmeal_combo'] },
  food_budget: { basis: 'v4_proxy_model', inputs: ['mcmeal_combo', 'inexpensive_restaurant_meal_1p'] },
  food_mid_range: {
    basis: 'v4_proxy_model',
    inputs: ['mcmeal_combo', 'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p'],
  },
  food_high_end: {
    basis: 'v4_proxy_model',
    inputs: ['inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p'],
  },
  drink_coffee: { basis: 'direct', inputs: ['cappuccino_1'] },
  drinks_none: { basis: 'direct_basket', inputs: ['cappuccino_1'] },
  drinks_light: { basis: 'direct_basket', inputs: ['cappuccino_1', 'domestic_draft_beer_1'] },
  drinks_moderate: { basis: 'v4_proxy_model', inputs: ['cappuccino_1', 'domestic_draft_beer_1'] },
  drinks_heavy: {
    basis: 'v4_proxy_model',
    inputs: ['cappuccino_1', 'domestic_draft_beer_1'],
  },
  activities_free: { basis: 'definitional', inputs: [] },
  activities_budget: { basis: 'direct', inputs: ['paid_attraction_adult_1'] },
  activities_mid_range: { basis: 'direct', inputs: ['half_day_group_activity_adult_1'] },
  activities_high_end: { basis: 'direct', inputs: ['full_day_premium_activity_adult_1'] },
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function addPresence(map, city, measure, source) {
  if (!city || !measure) return;
  if (!map.has(city)) map.set(city, new Map());
  const cityMap = map.get(city);
  if (!cityMap.has(measure)) cityMap.set(measure, new Set());
  cityMap.get(measure).add(source);
}

function addCityMeta(meta, city, values = {}) {
  if (!city) return;
  const current = meta.get(city) ?? {};
  meta.set(city, {
    ...current,
    city,
    region: values.region ?? current.region ?? null,
    country: values.country ?? current.country ?? null,
    currency: values.currency ?? current.currency ?? null,
  });
}

function addSampleCities(presence, meta, file, data) {
  for (const city of data.cities ?? []) {
    addCityMeta(meta, city.city, city);
    if (city.anchors) {
      const anchorMap = {
        inexp_meal_1p: 'inexpensive_restaurant_meal_1p',
        midrange_meal_2p: 'midrange_restaurant_meal_2p',
        mcmeal_combo: 'mcmeal_combo',
        beer_draft_0_5l: 'domestic_draft_beer_1',
        cappuccino: 'cappuccino_1',
      };
      for (const [key, measure] of Object.entries(anchorMap)) {
        if (typeof city.anchors[key] === 'number' && city.anchors[key] > 0) {
          addPresence(presence, city.city, measure, file);
        }
      }
      continue;
    }
    const fieldMap = {
      inexp: 'inexpensive_restaurant_meal_1p',
      midrange: 'midrange_restaurant_meal_2p',
      mcmeal: 'mcmeal_combo',
      beer: 'domestic_draft_beer_1',
      cappuccino: 'cappuccino_1',
    };
    for (const [key, measure] of Object.entries(fieldMap)) {
      if (typeof city[key] === 'number' && city[key] > 0) addPresence(presence, city.city, measure, file);
    }
  }
}

function addObservationFiles(presence, meta) {
  const dir = path.join(ROOT, 'data', 'reference', 'observations');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl')).sort();
  const seen = new Set();
  let rows = 0;
  let duplicateRows = 0;
  const sourceCounts = {};

  for (const file of files) {
    const fullPath = path.join(dir, file);
    for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
      const observation = JSON.parse(line);
      rows += 1;
      if (seen.has(observation.observationId)) {
        duplicateRows += 1;
        continue;
      }
      seen.add(observation.observationId);
      if (observation.valueStatus !== 'direct' || observation.reviewerStatus !== 'accepted') continue;
      addCityMeta(meta, observation.city, observation);
      addPresence(presence, observation.city, observation.measure, `observations/${file}`);
      sourceCounts[observation.sourceName] = (sourceCounts[observation.sourceName] ?? 0) + 1;
    }
  }

  return { files, rows, uniqueRows: seen.size, duplicateRows, sourceCounts };
}

function cityCountForInputs(presence, inputs, proxyInputs = []) {
  const all = [...inputs, ...proxyInputs];
  return [...presence.entries()].filter(([, measures]) => all.every((measure) => measures.has(measure))).length;
}

function measureSummary(presence) {
  return Object.fromEntries(DIRECT_MEASURES.map((measure) => {
    const cities = [...presence.entries()]
      .filter(([, measures]) => measures.has(measure))
      .map(([city]) => city)
      .sort();
    return [measure, { cityCount: cities.length, cities }];
  }));
}

function productionCityMeta() {
  const file = path.join(ROOT, 'data', 'reference', 'city_costs_app_aud.csv');
  const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const columns = header.split(',');
  const cityIndex = columns.indexOf('city');
  const regionIndex = columns.indexOf('region');
  const cities = new Map();
  for (const line of lines) {
    const fields = line.split(',');
    const city = fields[cityIndex];
    cities.set(city, { city, region: fields[regionIndex] });
  }
  return cities;
}

const presence = new Map();
const meta = new Map();
for (const file of SAMPLE_FILES) addSampleCities(presence, meta, file, readJson(file));
const observationStats = addObservationFiles(presence, meta);
const productionCities = productionCityMeta();

const productCoverage = Object.fromEntries(Object.entries(PRODUCT_DEPENDENCIES).map(([product, spec]) => {
  const inputs = [...spec.inputs, ...(spec.proxyInputs ?? [])];
  return [product, {
    basis: spec.basis,
    requiredInputs: inputs,
    completeCityCount: spec.basis === 'definitional' ? productionCities.size : cityCountForInputs(presence, spec.inputs, spec.proxyInputs),
    completeCities: spec.basis === 'definitional'
      ? [...productionCities.keys()].sort()
      : [...presence.entries()]
        .filter(([, measures]) => inputs.every((measure) => measures.has(measure)))
        .map(([city]) => city)
        .sort(),
  }];
}));

const regionCounts = {};
for (const city of presence.keys()) {
  const region = meta.get(city)?.region ?? 'unknown';
  regionCounts[region] = (regionCounts[region] ?? 0) + 1;
}

const report = {
  schemaVersion: 'city-cost-v5-baseline-audit-v1',
  experiment: '000-baseline-reassessment',
  sourceSamples: SAMPLE_FILES,
  observationFiles: observationStats.files.map((file) => `data/reference/observations/${file}`),
  observationStats,
  uniqueEvidenceCities: presence.size,
  evidenceRegionCounts: regionCounts,
  productionCityCount: productionCities.size,
  directMeasureCoverage: measureSummary(presence),
  productCoverage,
  knownV4ProxyModels: {
    street_food_meal_1p: 'modelled from mcmeal_combo using v4 proxy form; coefficient not calibrated on street-food observations',
    premium_restaurant_meal_2p: 'modelled from midrange_restaurant_meal_2p using v4 proxy form; coefficient not calibrated on premium observations',
    cocktail_1: 'modelled from domestic_draft_beer_1 using v4 proxy form; coefficient not calibrated on cocktail observations',
    wine_glass_1: 'modelled from domestic_draft_beer_1 using v4 proxy form; coefficient not calibrated on wine observations',
  },
  verdict: {
    baselineUsefulFor: ['food and drink anchor coverage', 'proxy model-form comparison', 'provenance schema reuse'],
    baselineFailsBecause: [
      'target cheap-model one-call feasibility has not been tested',
      'accommodation dorm/private and star-level coverage is incomplete',
      'activity half-day and full-day measures are sparse or absent',
      'v4 proxy relationships are not coefficient-calibrated on their shipped targets',
      'the shipping CSV contains asserted values and is not independent ground truth',
    ],
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
