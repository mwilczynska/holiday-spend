// Generate the prediction side of the v6 development panel by calling the
// same collection and materialization functions used by production.

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { collectCityCostV6Anchors, v6CollectionRegion } from '../src/lib/city-cost-v6-collection';
import { materializeCityCostV6 } from '../src/lib/city-cost-methodology-v6';

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, 'data/reference/v6/validation-manifest-v6.json');
const SHIPPING_CSV = path.join(ROOT, 'data/reference/city_costs_app_aud.csv');
const OUT_DIR = path.join(ROOT, 'data/reference/v6/experiments/002-production-prediction-bundle');
const CITY_DIR = path.join(OUT_DIR, 'cities');
const REFERENCE_DATE = process.env.V6_REFERENCE_DATE || '2026-09-17';

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

function countryIndex() {
  const parsed = Papa.parse<{ city?: string; country?: string }>(fs.readFileSync(SHIPPING_CSV, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  const result = new Map<string, string>();
  for (const row of parsed.data) {
    if (row.city && row.country) result.set(row.city, row.country);
  }
  return result;
}

function cliValue(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

type DevelopmentCity = { city: string; region: string; band: string };
type BundleRow = {
  city: string;
  country: string | null;
  region: string;
  band: string;
  status: 'found' | 'not_run';
  referenceDate?: string;
  productionPath?: Record<string, string>;
  collection?: Awaited<ReturnType<typeof collectCityCostV6Anchors>>;
  materialization?: ReturnType<typeof materializeCityCostV6>;
  reason?: string;
};

async function main() {
  const provider = cliValue('provider') as 'anthropic' | 'openai' | 'gemini' | undefined;
  const apiKey = cliValue('api-key') || process.env.V6_API_KEY;
  const model = cliValue('model') || process.env.V6_MODEL;
  const manifest = readJson<{ groundTruthPanel: { development: { cities: DevelopmentCity[] } } }>(MANIFEST);
  const countries = countryIndex();
  const cities = manifest.groundTruthPanel.development.cities;
  const startedAt = new Date().toISOString();
  const rows: BundleRow[] = [];

for (const entry of cities) {
  const country = countries.get(entry.city);
  if (!country) {
    rows.push({
      city: entry.city,
      country: null,
      region: entry.region,
      band: entry.band,
      status: 'not_run',
      reason: 'country_not_in_shipping_csv',
    });
    continue;
  }

  const base = {
    city: entry.city,
    country,
    region: v6CollectionRegion(entry.region) ?? entry.region,
    band: entry.band,
    referenceDate: REFERENCE_DATE,
    productionPath: {
      collection: 'collectCityCostV6Anchors',
      materialization: 'materializeCityCostV6',
      provider: provider || 'production-provider-resolution',
    },
  };

  try {
    const collection = await collectCityCostV6Anchors({
      city: entry.city,
      country,
      region: entry.region,
      referenceDate: REFERENCE_DATE,
      provider,
      apiKey,
      model,
    });
    const materialization = materializeCityCostV6({
      city: entry.city,
      country,
      region: entry.region,
      anchors: collection.anchors,
    });
    const row: BundleRow = { ...base, status: 'found', collection, materialization };
    rows.push(row);
    writeJson(path.join(CITY_DIR, `${slug(entry.city)}.json`), row);
    console.log(`${entry.city}: found (${collection.llmCalls} calls, ${collection.searches} searches)`);
  } catch (error) {
    const row: BundleRow = {
      ...base,
      status: 'not_run',
      reason: error instanceof Error ? error.message : String(error),
    };
    rows.push(row);
    writeJson(path.join(CITY_DIR, `${slug(entry.city)}.json`), row);
    console.log(`${entry.city}: not_run (${row.reason})`);
  }
  }

  const found = rows.filter((row) => row.status === 'found').length;
  writeJson(path.join(OUT_DIR, 'results.json'), {
  schemaVersion: 'city-cost-v6-prediction-bundle-v1',
  methodologyVersion: 'v6.0',
  panel: 'development',
  manifestPath: 'data/reference/v6/validation-manifest-v6.json',
  referenceDate: REFERENCE_DATE,
  productionPath: 'collectCityCostV6Anchors -> materializeCityCostV6',
  provider: provider || 'production-provider-resolution',
  startedAt,
  completedAt: new Date().toISOString(),
  totalCities: rows.length,
  foundCities: found,
  notRunCities: rows.length - found,
  rows: rows.map(({ materialization, collection, ...row }) => ({
    ...row,
    tierCount: materialization ? Object.keys(materialization.tiersAud).length : 0,
    llmCalls: collection?.llmCalls ?? 0,
    searches: collection?.searches ?? 0,
  })),
  });

  console.log(`Prediction bundle: ${found}/${rows.length} cities materialized.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
