// Normalize the already-captured v6.0 development evidence into the v6.1
// source-native response contract. This script performs no collection.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OLD_DIR = path.join(ROOT, 'data/reference/v6/experiments/006-development-prediction-spine');
const BYT_DIR = path.join(ROOT, 'data/reference/v6/experiments/003-budgetyourtrip-tier-panel/cities');
const MANIFEST = path.join(ROOT, 'data/reference/v6/validation-manifest-v6.json');
const OUT_DIR = path.join(ROOT, 'data/reference/v6/experiments/008-v6-1-development-fixtures');
const SPINE_DIR = path.join(OUT_DIR, 'spine');
const TELEMETRY_DIR = path.join(OUT_DIR, 'telemetry');
const CHECK = process.argv.includes('--check');

const SOURCE_LIMITS = {
  expedia_3star: 4,
  budgetyourtrip_daily_tiers: 4,
  numbeo_drinks: 2,
};

const SOURCE_PROMPTS = {
  expedia_3star: 'llm_prompt_city_cost_v6_1_expedia_3star.md',
  budgetyourtrip_daily_tiers: 'llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md',
  numbeo_drinks: 'llm_prompt_city_cost_v6_1_numbeo_drinks.md',
};

const FOOD_MEASURES = {
  food_budget_per_person_day: 'byt_food_budget_per_person_day',
  food_mid_per_person_day: 'byt_food_mid_per_person_day',
  food_high_per_person_day: 'byt_food_high_per_person_day',
};

const ACTIVITY_MEASURES = {
  activities_budget_per_person_day: 'byt_activities_budget_per_person_day',
  activities_mid_per_person_day: 'byt_activities_mid_per_person_day',
  activities_high_per_person_day: 'byt_activities_high_per_person_day',
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function existing(file, label) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${label}: ${file}`);
  return readJson(file);
}

function cappedSearches(value, source) {
  const numeric = Number.isInteger(value) && value >= 0 ? value : 0;
  return Math.min(numeric, SOURCE_LIMITS[source]);
}

function sourceStatus(value) {
  if (value === 'found' || value === 'observed') return 'observed';
  if (['blocked', 'stale', 'class_absent'].includes(value)) return value;
  return 'not_found';
}

function normalizedMeasure(raw, measure, fallbackUrl, fallbackTitle, query) {
  const status = sourceStatus(raw?.status);
  const observed = status === 'observed';
  const value = observed && Number.isFinite(raw.value) ? raw.value : null;
  if (observed && value === null) throw new Error(`Observed ${measure} has no numeric value.`);
  return {
    status,
    value,
    currency: observed ? (raw.currency ?? null) : null,
    sourceUrl: observed ? (raw.sourceUrl ?? fallbackUrl) : null,
    sourceTitle: raw.sourceTitle ?? fallbackTitle,
    evidenceText: raw.evidenceText ?? raw.reason ?? '',
    query: raw.query ?? query,
    taxStatus: ['included', 'excluded', 'mixed', 'unknown'].includes(raw.taxStatus) ? raw.taxStatus : 'unknown',
  };
}

function retrievalStatus(measures) {
  const statuses = Object.values(measures).map((measure) => measure.status);
  if (statuses.every((status) => status === 'observed')) return 'complete';
  if (statuses.every((status) => status === 'not_found')) return 'not_found';
  if (statuses.some((status) => status === 'blocked')) return 'blocked';
  return 'partial';
}

function response({ source, city, country, measures, searchesUsed, originalSearchesUsed, sourceNote }) {
  const limitedSearches = cappedSearches(searchesUsed, source);
  return {
    schemaVersion: 'city-cost-v6-1-spine-response-v1',
    source,
    city,
    country,
    retrievalStatus: retrievalStatus(measures),
    searchesUsed: limitedSearches,
    directPageReads: 0,
    notes: [
      'Deterministically normalized from existing v6 development evidence; no new collection.',
      sourceNote,
      `Original v6.0 searchesUsed=${originalSearchesUsed}; v6.1 fixture budget=${limitedSearches}.`,
    ].join(' '),
    measures,
  };
}

function telemetry({ source, city, country, rawTelemetry, responseValue }) {
  const originalSearchesUsed = rawTelemetry?.searchesUsed ?? responseValue.searchesUsed;
  const searchesUsed = cappedSearches(originalSearchesUsed, source);
  return {
    schemaVersion: 'city-cost-v6-1-spine-telemetry-v1',
    city,
    country,
    source,
    provider: rawTelemetry?.provider ?? 'delegated-gpt-5.6-luna',
    model: rawTelemetry?.model ?? 'gpt-5.6-luna',
    attempts: rawTelemetry?.providerCalls ?? rawTelemetry?.attempts ?? 1,
    providerCalls: rawTelemetry?.providerCalls ?? rawTelemetry?.attempts ?? 1,
    retries: rawTelemetry?.retries ?? 0,
    searchesUsed,
    directPageReads: 0,
    status: responseValue.retrievalStatus,
    promptVersion: SOURCE_PROMPTS[source],
    originalPromptVersion: rawTelemetry?.promptVersion ?? null,
    originalSearchesUsed,
    fixtureSource: '006-development-prediction-spine + 003-budgetyourtrip-tier-panel',
    startedAt: '2026-08-10T00:00:00.000Z',
    completedAt: '2026-08-10T00:00:00.000Z',
    durationMs: 0,
  };
}

function oldResponse(citySlug, source) {
  const oldSource = source === 'budgetyourtrip_daily_tiers' ? 'budgetyourtrip' : source === 'numbeo_drinks' ? 'numbeo' : source;
  return existing(path.join(OLD_DIR, 'responses', citySlug, `${oldSource}.json`), `${oldSource} response for ${citySlug}`);
}

function oldTelemetry(citySlug, source) {
  const oldSource = source === 'budgetyourtrip_daily_tiers' ? 'budgetyourtrip' : source === 'numbeo_drinks' ? 'numbeo' : source;
  return existing(path.join(OLD_DIR, 'telemetry', citySlug, `${oldSource}.json`), `${oldSource} telemetry for ${citySlug}`);
}

function buildExpedia(city, country, citySlug) {
  const raw = oldResponse(citySlug, 'expedia_3star');
  const rawMeasure = raw.measures?.hotel_3star_room_2p;
  const measures = {
    hotel_3star_room_2p: normalizedMeasure(
      rawMeasure,
      'hotel_3star_room_2p',
      null,
      rawMeasure?.sourceTitle ?? 'Expedia 3-star city accommodation proxy',
      `Expedia ${city} 3-star room for two adults`
    ),
  };
  return response({
    source: 'expedia_3star',
    city,
    country,
    measures,
    searchesUsed: raw.searchesUsed,
    originalSearchesUsed: raw.searchesUsed,
    sourceNote: 'Expedia 3-star remains the calibrated accommodation proxy; only the anchor name changed.',
  });
}

function buildNumbeo(city, country, citySlug) {
  const raw = oldResponse(citySlug, 'numbeo_drinks');
  const measures = {
    cappuccino_1: normalizedMeasure(
      raw.measures?.cappuccino_1,
      'cappuccino_1',
      null,
      raw.measures?.cappuccino_1?.sourceTitle ?? 'Numbeo cost-of-living city page',
      `Numbeo ${city} cappuccino`
    ),
    domestic_draft_beer_1: normalizedMeasure(
      raw.measures?.domestic_draft_beer_1,
      'domestic_draft_beer_1',
      null,
      raw.measures?.domestic_draft_beer_1?.sourceTitle ?? 'Numbeo cost-of-living city page',
      `Numbeo ${city} domestic draft beer`
    ),
  };
  return response({
    source: 'numbeo_drinks',
    city,
    country,
    measures,
    searchesUsed: raw.searchesUsed,
    originalSearchesUsed: raw.searchesUsed,
    sourceNote: 'Only cappuccino and domestic draft beer are retained; legacy food and McMeal fields are excluded from v6.1.',
  });
}

function buildBudgetYourTrip(city, country, citySlug) {
  const oldRaw = oldResponse(citySlug, 'budgetyourtrip_daily_tiers');
  const byt = existing(path.join(BYT_DIR, `${citySlug}.json`), `BudgetYourTrip tier panel row for ${city}`);
  const rawMeasures = { ...(byt.measures ?? {}) };
  const measures = {};
  for (const [oldName, newName] of Object.entries(FOOD_MEASURES)) {
    const raw = rawMeasures[oldName];
    measures[newName] = normalizedMeasure(
      raw,
      newName,
      byt.sourceUrl ?? null,
      raw?.sourceTitle ?? 'BudgetYourTrip city daily food tier',
      `BudgetYourTrip ${city} labelled daily food tier`
    );
  }
  for (const [oldName, newName] of Object.entries(ACTIVITY_MEASURES)) {
    const raw = rawMeasures[oldName];
    measures[newName] = normalizedMeasure(
      raw,
      newName,
      byt.sourceUrl ?? null,
      raw?.sourceTitle ?? 'BudgetYourTrip city daily activity tier',
      `BudgetYourTrip ${city} labelled daily entertainment tier`
    );
  }
  return response({
    source: 'budgetyourtrip_daily_tiers',
    city,
    country,
    measures,
    searchesUsed: oldRaw.searchesUsed,
    originalSearchesUsed: oldRaw.searchesUsed,
    sourceNote: 'Food and activity values come from the existing labelled per-person/day panel; they are source-backed production values, not independent truth in v6.1.',
  });
}

function main() {
  const manifest = existing(MANIFEST, 'v6.0 development manifest');
  const cities = manifest.groundTruthPanel?.development?.cities;
  if (!Array.isArray(cities) || cities.length !== 25) throw new Error('Expected exactly 25 v6 development cities.');
  const rows = [];
  const generated = new Map();

  for (const entry of cities) {
    const citySlug = slug(entry.city);
    const expedia = buildExpedia(entry.city, null, citySlug);
    const country = oldResponse(citySlug, 'expedia_3star').country;
    if (!country) throw new Error(`Missing country for ${entry.city}.`);
    const normalized = {
      expedia_3star: { ...expedia, country },
      budgetyourtrip_daily_tiers: buildBudgetYourTrip(entry.city, country, citySlug),
      numbeo_drinks: buildNumbeo(entry.city, country, citySlug),
    };
    const telemetries = Object.fromEntries(
      Object.entries(normalized).map(([source, value]) => [source, telemetry({
        source,
        city: entry.city,
        country,
        rawTelemetry: oldTelemetry(citySlug, source),
        responseValue: value,
      })])
    );
    generated.set(citySlug, { city: entry.city, country, region: entry.region, band: entry.band, normalized, telemetries });
    rows.push({
      city: entry.city,
      country,
      region: entry.region,
      band: entry.band,
      sources: Object.fromEntries(Object.entries(normalized).map(([source, value]) => [source, {
        retrievalStatus: value.retrievalStatus,
        observedMeasures: Object.values(value.measures).filter((measure) => measure.status === 'observed').length,
        missingMeasures: Object.values(value.measures).filter((measure) => measure.status !== 'observed').length,
        searchesUsed: value.searchesUsed,
        originalSearchesUsed: Number(value.notes.match(/Original v6\.0 searchesUsed=(\d+)/)?.[1] ?? value.searchesUsed),
      }])),
    });
  }

  if (CHECK) {
    for (const [citySlug, value] of generated) {
      for (const [source, responseValue] of Object.entries(value.normalized)) {
        const file = path.join(SPINE_DIR, citySlug, `${source}.json`);
        const telemetryFile = path.join(TELEMETRY_DIR, citySlug, `${source}.json`);
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== `${JSON.stringify(responseValue, null, 2)}\n`) {
          throw new Error(`v6.1 fixture mismatch: ${file}`);
        }
        const telemetryValue = value.telemetries[source];
        if (!fs.existsSync(telemetryFile) || fs.readFileSync(telemetryFile, 'utf8') !== `${JSON.stringify(telemetryValue, null, 2)}\n`) {
          throw new Error(`v6.1 telemetry fixture mismatch: ${telemetryFile}`);
        }
      }
    }
    console.log(JSON.stringify({ passed: true, cities: generated.size, output: path.relative(ROOT, OUT_DIR).replaceAll('\\', '/') }, null, 2));
    return;
  }

  for (const [citySlug, value] of generated) {
    for (const [source, responseValue] of Object.entries(value.normalized)) {
      writeJson(path.join(SPINE_DIR, citySlug, `${source}.json`), responseValue);
      writeJson(path.join(TELEMETRY_DIR, citySlug, `${source}.json`), value.telemetries[source]);
    }
  }
  writeJson(path.join(OUT_DIR, 'inputs.json'), {
    schemaVersion: 'city-cost-v6-1-development-fixtures-inputs-v1',
    generatedAt: '2026-08-10',
    panel: 'development',
    sourceExperiments: [
      'data/reference/v6/experiments/006-development-prediction-spine/',
      'data/reference/v6/experiments/003-budgetyourtrip-tier-panel/',
    ],
    normalizedContract: 'city-cost-v6-1-spine-response-v1',
    cities: rows,
    collectionCalls: 0,
    holdoutRead: false,
  });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'experiment.md'), `# Experiment 008 — v6.1 development fixtures\n\nStatus: generated from existing experiments; no collection.\n\nThis directory normalizes the 006 delegated Expedia/Numbeo/BudgetYourTrip responses and the 003 labelled BudgetYourTrip daily-tier panel into the v6.1 three-source response contract. It is an auditable Stage-A fixture set, not a new observation panel. Original search counts are retained in each response note and sidecar telemetry; v6.1 validation uses the new per-source limits.\n\nThe v6.1 materializer is the only Stage-B implementation used downstream. No holdout file or shipping CSV is read.\n`);
  writeJson(path.join(OUT_DIR, 'results.json'), {
    schemaVersion: 'city-cost-v6-1-development-fixtures-v1',
    methodologyVersion: 'v6.1',
    panel: 'development',
    generatedAt: '2026-08-10',
    cities: rows.length,
    sourceResponses: rows.reduce((sum, row) => sum + Object.keys(row.sources).length, 0),
    collectionCalls: 0,
    holdoutRead: false,
    rows,
  });
  fs.writeFileSync(path.join(OUT_DIR, 'verdict.md'), `# Verdict\n\nThe v6.1 Stage-A fixture set is complete for ${rows.length}/25 development cities. It uses no new LLM calls and preserves explicit missingness from the existing records. Stage B must materialize these responses through the real v6.1 collector boundary and deterministic materializer.\n`);
  console.log(JSON.stringify({ passed: true, cities: generated.size, output: path.relative(ROOT, OUT_DIR).replaceAll('\\', '/') }, null, 2));
}

main();
