import fs from 'node:fs';
import path from 'node:path';
import { buildV61CollectionResultFromSpineResponses, V61_SPINE_SOURCES } from '../src/lib/city-cost-v6-1-collection';
import { materializeCityCostV61 } from '../src/lib/city-cost-methodology-v6-1';
import { V5_TIER_NAMES } from '../src/lib/city-cost-methodology-v5';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'data/reference/v6/experiments/008-v6-1-development-fixtures');
const INPUTS_PATH = path.join(FIXTURE_DIR, 'inputs.json');
const CITY_DIR = path.join(FIXTURE_DIR, 'materialized');
const RESULTS_PATH = path.join(FIXTURE_DIR, 'materialization-results.json');
const CHECK = process.argv.includes('--check');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function expectedText(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

type FixtureInputs = {
  cities: Array<{ city: string; country: string; region: string; band: string }>;
};

function loadCollection(city: FixtureInputs['cities'][number]) {
  const citySlug = slug(city.city);
  const responses = Object.fromEntries(
    V61_SPINE_SOURCES.map((source) => [
      source,
      readJson(path.join(FIXTURE_DIR, 'spine', citySlug, `${source}.json`)),
    ])
  ) as Record<(typeof V61_SPINE_SOURCES)[number], unknown>;
  const telemetry = Object.fromEntries(
    V61_SPINE_SOURCES.map((source) => [
      source,
      readJson(path.join(FIXTURE_DIR, 'telemetry', citySlug, `${source}.json`)),
    ])
  );
  return buildV61CollectionResultFromSpineResponses({
    city: city.city,
    country: city.country,
    responses,
    telemetry,
  });
}

function validateMaterialization(city: string, materialization: ReturnType<typeof materializeCityCostV61>) {
  if (!materialization.complete || Object.keys(materialization.tiersAud).length !== V5_TIER_NAMES.length) {
    throw new Error(`${city}: expected all ${V5_TIER_NAMES.length} v6.1 tiers.`);
  }
  for (const tier of V5_TIER_NAMES) {
    const value = materialization.tiersAud[tier];
    if (!Number.isFinite(value.amountAud) || value.amountAud < 0) throw new Error(`${city}/${tier}: invalid amount.`);
    if (!value.evidenceBasis || !value.evidenceGrade || !value.interval || !value.sourceIds || !value.modelVersions || !value.imputedMeasures) {
      throw new Error(`${city}/${tier}: incomplete provenance.`);
    }
  }
}

function main() {
  const inputs = readJson<FixtureInputs>(INPUTS_PATH);
  const rows: Array<Record<string, unknown>> = [];
  const cityBundles = new Map<string, unknown>();
  const categoryCounts = {
    accommodation: { direct: 0, fallback: 0 },
    food: { direct: 0, fallback: 0 },
    drinks: { direct: 0, fallback: 0 },
    activities: { direct: 0, fallback: 0 },
  };

  for (const city of inputs.cities) {
    const collection = loadCollection(city);
    const materialization = materializeCityCostV61({
      city: city.city,
      country: city.country,
      region: city.region,
      anchors: collection.anchors,
    });
    validateMaterialization(city.city, materialization);
    const categoryFallback = {
      accommodation: materialization.tiersAud.accom_3_star.evidenceBasis === 'imputed',
      food: materialization.tiersAud.food_budget.evidenceBasis === 'imputed',
      drinks: materialization.tiersAud.drinks_none.evidenceBasis === 'imputed',
      activities: materialization.tiersAud.activities_budget.evidenceBasis === 'imputed',
    };
    for (const [category, fallback] of Object.entries(categoryFallback) as Array<[keyof typeof categoryCounts, boolean]>) {
      categoryCounts[category][fallback ? 'fallback' : 'direct'] += 1;
    }
    const bundle = {
      schemaVersion: 'city-cost-v6-1-development-materialization-v1',
      methodologyVersion: 'v6.1',
      city: city.city,
      country: city.country,
      region: city.region,
      band: city.band,
      mode: 'from-existing-fixtures',
      productionPath: 'v6.1 Stage-A response validation -> buildV61CollectionResultFromSpineResponses -> materializeCityCostV61',
      collection,
      materialization,
    };
    cityBundles.set(slug(city.city), bundle);
    rows.push({
      city: city.city,
      country: city.country,
      region: city.region,
      band: city.band,
      tierCount: Object.keys(materialization.tiersAud).length,
      sourceFacts: collection.facts.length,
      observedSourceFacts: collection.facts.filter((fact) => fact.status === 'observed').length,
      missingSourceFacts: collection.facts.filter((fact) => fact.status !== 'observed').length,
      searches: collection.searches,
      directPageReads: collection.telemetry.reduce((sum, item) => sum + item.directPageReads, 0),
      fallbackCategories: Object.entries(categoryFallback).filter(([, fallback]) => fallback).map(([category]) => category),
    });
  }

  const results = {
    schemaVersion: 'city-cost-v6-1-development-materialization-v1',
    methodologyVersion: 'v6.1',
    panel: 'development',
    generatedAt: '2026-08-10',
    mode: 'from-existing-fixtures',
    sourceFixtureDirectory: 'data/reference/v6/experiments/008-v6-1-development-fixtures/spine',
    priors: 'data/reference/v6/priors-v6-1.json',
    cities: rows.length,
    allCitiesComplete: rows.length === 25 && rows.every((row) => row.tierCount === 19),
    categoryFallbackCounts: categoryCounts,
    holdoutRead: false,
    csvRead: false,
    rows,
  };

  if (CHECK) {
    cityBundles.forEach((bundle, citySlug) => {
      const file = path.join(CITY_DIR, `${citySlug}.json`);
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expectedText(bundle)) throw new Error(`Stale v6.1 materialization: ${file}`);
    });
    if (!fs.existsSync(RESULTS_PATH) || fs.readFileSync(RESULTS_PATH, 'utf8') !== expectedText(results)) throw new Error('Stale v6.1 materialization results.');
    console.log(JSON.stringify({ passed: true, cities: rows.length, tiers: V5_TIER_NAMES.length, categoryFallbackCounts: categoryCounts }, null, 2));
    return;
  }

  cityBundles.forEach((bundle, citySlug) => writeJson(path.join(CITY_DIR, `${citySlug}.json`), bundle));
  writeJson(RESULTS_PATH, results);
  console.log(JSON.stringify({ passed: true, cities: rows.length, tiers: V5_TIER_NAMES.length, categoryFallbackCounts: categoryCounts }, null, 2));
}

main();
