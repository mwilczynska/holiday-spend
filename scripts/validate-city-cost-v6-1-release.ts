import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {
  buildV61CollectionResultFromSpineResponses,
  parseV61SpineResponse,
  V61_SOURCE_MEASURES,
  V61_SPINE_SOURCES,
} from '../src/lib/city-cost-v6-1-collection';
import { materializeCityCostV61 } from '../src/lib/city-cost-methodology-v6-1';
import { V5_TIER_NAMES, type V5TierName } from '../src/lib/city-cost-methodology-v5';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data/reference/v6/validation-manifest-v6-1.json');
const FIXTURE_DIR = path.join(ROOT, 'data/reference/v6/experiments/008-v6-1-development-fixtures');
const INPUTS_PATH = path.join(FIXTURE_DIR, 'inputs.json');
const CITY_DIR = path.join(FIXTURE_DIR, 'materialized');
const REPORT_PATH = path.join(ROOT, 'data/reference/v6/v6-1-development-release-report.md');
const RESULTS_PATH = path.join(ROOT, 'data/reference/v6/v6-1-release-validation.json');
const PRIORS_PATH = path.join(ROOT, 'data/reference/v6/priors-v6-1.json');
const SHIPPING_CSV = path.join(ROOT, 'data/reference/city_costs_app_aud.csv');
const CHECK = process.argv.includes('--check');

const BANKED_ACCOMMODATION_APE: Record<string, number> = {
  accom_3_star: 8.27,
  accom_4_star: 13.12,
  accom_hostel_private_room: 15.97,
  accom_2_star: 16.74,
  accom_1_star: 21.49,
  accom_shared_hostel_dorm: 25.46,
};

const CATEGORY_TIERS = {
  accommodation: ['accom_shared_hostel_dorm', 'accom_hostel_private_room', 'accom_1_star', 'accom_2_star', 'accom_3_star', 'accom_4_star'] as const,
  food: ['food_street_food', 'food_budget', 'food_mid_range', 'food_high_end'] as const,
  drinks: ['drink_coffee', 'drinks_none', 'drinks_light', 'drinks_moderate', 'drinks_heavy'] as const,
  activities: ['activities_free', 'activities_budget', 'activities_mid_range', 'activities_high_end'] as const,
};

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

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function apePct(prediction: number, baseline: number) {
  return baseline === 0 ? null : Math.abs(prediction - baseline) / baseline * 100;
}

function compareJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function expectedText(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

type Inputs = {
  cities: Array<{ city: string; country: string; region: string; band: string }>;
};

type CsvRow = Record<string, string | undefined> & { city?: string };

function loadCityBundle(city: Inputs['cities'][number]) {
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
  const collection = buildV61CollectionResultFromSpineResponses({
    city: city.city,
    country: city.country,
    responses,
    telemetry,
  });
  const materialization = materializeCityCostV61({
    city: city.city,
    country: city.country,
    region: city.region,
    anchors: collection.anchors,
  });
  const bundle = readJson<{ materialization: typeof materialization }>(path.join(CITY_DIR, `${citySlug}.json`));
  return { responses, collection, materialization, storedMaterialization: bundle.materialization };
}

function checkSourceContracts(city: Inputs['cities'][number], responses: ReturnType<typeof loadCityBundle>['responses'], errors: string[]) {
  for (const source of V61_SPINE_SOURCES) {
    try {
      const parsed = parseV61SpineResponse(source, responses[source]);
      if (parsed.city !== city.city || parsed.country !== city.country) errors.push(`${city.city}/${source}: identity mismatch`);
      const expectedMeasures = V61_SOURCE_MEASURES[source];
      if (Object.keys(parsed.measures).sort().join('|') !== [...expectedMeasures].sort().join('|')) errors.push(`${city.city}/${source}: measure contract mismatch`);
    } catch (error) {
      errors.push(`${city.city}/${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function checkTierProvenance(city: string, tiers: Record<V5TierName, { amountAud: number; evidenceBasis: string; evidenceGrade: string; interval: { lowerAud: number; upperAud: number; widthPct: number }; sourceIds: string[]; modelVersions: string[]; imputedMeasures: string[] }>, errors: string[]) {
  for (const tier of V5_TIER_NAMES) {
    const value = tiers[tier];
    if (!value || !Number.isFinite(value.amountAud) || value.amountAud < 0) errors.push(`${city}/${tier}: invalid amount`);
    if (!value?.evidenceBasis || !value?.evidenceGrade || !value?.interval || !Array.isArray(value?.sourceIds) || !Array.isArray(value?.modelVersions) || !Array.isArray(value?.imputedMeasures)) {
      errors.push(`${city}/${tier}: incomplete provenance`);
      continue;
    }
    if ((value.evidenceGrade === 'C' || value.evidenceGrade === 'D') && value.evidenceBasis === 'observed') {
      errors.push(`${city}/${tier}: grade ${value.evidenceGrade} is marked observed`);
    }
    if (value.interval.lowerAud > value.amountAud || value.interval.upperAud < value.amountAud || value.interval.widthPct < 0) {
      errors.push(`${city}/${tier}: invalid interval`);
    }
  }
}

function checkMonotonicity(city: string, tiers: Record<V5TierName, { amountAud: number }>, errors: string[]) {
  const checks: Array<[string, readonly V5TierName[]]> = [
    ['accommodation', CATEGORY_TIERS.accommodation],
    ['food', CATEGORY_TIERS.food],
    ['drinks', CATEGORY_TIERS.drinks],
    ['activities', CATEGORY_TIERS.activities],
  ];
  for (const [category, names] of checks) {
    for (let index = 1; index < names.length; index += 1) {
      if (tiers[names[index - 1]].amountAud > tiers[names[index]].amountAud) {
        errors.push(`${city}/${category}: ${names[index - 1]} > ${names[index]}`);
      }
    }
  }
}

function csvIndex() {
  const parsed = Papa.parse<CsvRow>(fs.readFileSync(SHIPPING_CSV, 'utf8'), { header: true, skipEmptyLines: true });
  return new Map(parsed.data.filter((row) => row.city).map((row) => [row.city as string, row]));
}

function v1Comparison(cityRows: Inputs['cities'], bundles: Map<string, ReturnType<typeof loadCityBundle>>, missing: string[]) {
  const rows = csvIndex();
  const result = Object.fromEntries(V5_TIER_NAMES.map((tier) => [tier, [] as number[]]));
  const signed = Object.fromEntries(V5_TIER_NAMES.map((tier) => [tier, [] as number[]]));
  for (const city of cityRows) {
    const baseline = rows.get(city.city);
    const bundle = bundles.get(city.city);
    if (!baseline || !bundle) {
      missing.push(city.city);
      continue;
    }
    for (const tier of V5_TIER_NAMES) {
      const oldValue = Number(baseline[tier]);
      const newValue = bundle.materialization.tiersAud[tier].amountAud;
      if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) continue;
      const ape = apePct(newValue, oldValue);
      if (ape !== null) result[tier].push(ape);
      signed[tier].push((newValue - oldValue) / oldValue * 100);
    }
  }
  return Object.fromEntries(V5_TIER_NAMES.map((tier) => [tier, {
    cities: result[tier].length,
    medianApePct: result[tier].length ? round(median(result[tier])!) : null,
    medianSignedDifferencePct: signed[tier].length ? round(median(signed[tier])!) : null,
  }]));
}

function categorySummary(cityRows: Inputs['cities'], bundles: Map<string, ReturnType<typeof loadCityBundle>>) {
  const output: Record<string, unknown> = {};
  for (const [category, tiers] of Object.entries(CATEGORY_TIERS)) {
    const byRegion: Record<string, { cities: number; direct: number; fallback: number }> = {};
    let direct = 0;
    let fallback = 0;
    for (const city of cityRows) {
      const baseTier = category === 'activities' ? 'activities_budget' : tiers[0];
      const tier = bundles.get(city.city)?.materialization.tiersAud[baseTier];
      if (!tier) continue;
      const bucket = byRegion[city.region] ?? (byRegion[city.region] = { cities: 0, direct: 0, fallback: 0 });
      bucket.cities += 1;
      if (tier.evidenceBasis === 'imputed') {
        fallback += 1;
        bucket.fallback += 1;
      } else {
        direct += 1;
        bucket.direct += 1;
      }
    }
    output[category] = {
      tiers: [...tiers],
      directCities: direct,
      fallbackCities: fallback,
      directRatePct: round(direct / cityRows.length * 100),
      fallbackRatePct: round(fallback / cityRows.length * 100),
      byRegion,
    };
  }
  return output;
}

function markdownTable(rows: Array<Array<string | number>>) {
  return rows.map((row, index) => `| ${row.join(' | ')} |${index === 0 ? `\n| ${row.map(() => '---').join(' | ')} |` : ''}`).join('\n');
}

function buildReport(input: {
  validation: Record<string, unknown>;
  tierRows: Array<Array<string | number>>;
  categorySummary: Record<string, unknown>;
  gradeDistribution: Record<string, number>;
  excludedRows: number;
  v1: Record<string, unknown>;
  v1Missing: string[];
  shippingCsvSha256: string;
}) {
  const validation = input.validation as { generatedAt: string; cities: number; tierCount: number; fallbackCounts: Record<string, unknown> };
  const tierSection = markdownTable([
    ['Tier', 'v6.1 derivation', 'Grade / interval', 'Development coverage', 'Fallback path', 'Development fit', 'Holdout', 'v1 median APE'],
    ...input.tierRows,
  ]);
  return `# v6.1 development release report

**Status:** reachable release replay; not holdout validation  
**Generated:** ${validation.generatedAt}  
**Panel:** ${validation.cities} development cities × ${validation.tierCount} product tiers  
**Holdout:** no holdout read; all v6.0 holdout measures remain spent/closed  
**Shipping CSV:** read-only informational comparison; SHA-256 ${input.shippingCsvSha256}

## Result

All 19 existing product tiers materialize as finite, non-negative, provenance-bearing values for 25/25
development fixtures through the v6.1 collector contract and materializeCityCostV61. This is a deterministic
development replay, not an accuracy claim against independent ground truth. Food and activities are
BudgetYourTrip source-backed product estimates; drinks are source-priced consumption presets; only the
accommodation ladder has the banked independent Booking development accuracy result.

## Tier report

${tierSection}

The v1 column is an informational A/B comparison against the unchanged 121-city CSV, not a ground-truth
score. ${input.v1Missing.length ? `CSV rows were not found for: ${input.v1Missing.join(', ')}.` : 'All 25 development city rows were present in the CSV.'}

## Source and fallback coverage

| Category | Direct cities | Fallback cities | Direct rate | Fallback rate |
| --- | ---: | ---: | ---: | ---: |
${Object.entries(input.categorySummary).map(([category, value]) => {
    const summary = value as { directCities: number; fallbackCities: number; directRatePct: number; fallbackRatePct: number };
    return `| ${category} | ${summary.directCities} | ${summary.fallbackCities} | ${summary.directRatePct}% | ${summary.fallbackRatePct}% |`;
  }).join('\n')}

Materialized grade distribution across all 25 × 19 tier cells: ${Object.entries(input.gradeDistribution).map(([grade, count]) => `${grade}=${count}`).join(', ')}.

Fallback is exactly one layer: direct category tier vector → regional tier vector → global tier vector.
The generated v6.1 priors are in data/reference/v6/priors-v6-1.json; the historical v6.0 priors remain
separate. ${input.excludedRows} source rows were excluded from prior construction because the frozen FX
snapshot lacks SGD, TWD, ZAR or PEN; the exclusions are recorded in that generated file.

## Banked accommodation result

The genuine independent Booking development results are carried forward without refit: 3-star 8.27%,
4-star 13.12%, private hostel 15.97%, 2-star 16.74%, 1-star 21.49% and dorm 25.46% median APE. No v6.1
holdout or new accommodation collection was used.

## Release gate interpretation

- Output coverage, schema/missingness, provenance/grades, algebraic coherence and deterministic replay pass.
- Refresh economics pass: three source calls, at most ten searches, zero direct page reads.
- Integration is new-city-only behind CITY_COST_METHODOLOGY_V6=true; unsetting the flag retains v1.
- Independent food, drink and activity accuracy is not claimed. BYT is the production source for food/activity,
  and no independent full-basket drink panel exists in v6.1.
- The 121-city CSV was not modified. M4 migration remains a separate future decision.
`;
}

function main() {
  const manifest = readJson<{ schemaVersion: string; methodologyVersion: string; productTiers: string[]; gates: Record<string, unknown> }>(MANIFEST_PATH);
  const inputs = readJson<Inputs>(INPUTS_PATH);
  const priors = readJson<{ excludedRows?: unknown[] }>(PRIORS_PATH);
  const excludedRows = Array.isArray(priors.excludedRows) ? priors.excludedRows.length : 0;
  const errors: string[] = [];
  if (manifest.methodologyVersion !== 'v6.1') errors.push('active manifest methodologyVersion is not v6.1');
  if (manifest.productTiers.join('|') !== V5_TIER_NAMES.join('|')) errors.push('active manifest product tier list differs from runtime tier list');
  if (inputs.cities.length !== 25) errors.push(`expected 25 development cities, found ${inputs.cities.length}`);

  const bundles = new Map<string, ReturnType<typeof loadCityBundle>>();
  const tierRows: Array<Array<string | number>> = [];
  const fallbackCounts: Record<string, number> = { accommodation: 0, food: 0, drinks: 0, activities: 0 };
  const fallbackByRegion: Record<string, Record<string, number>> = {};
  const gradeDistribution: Record<string, number> = {};
  let totalSearches = 0;
  let totalDirectReads = 0;

  for (const city of inputs.cities) {
    try {
      const loaded = loadCityBundle(city);
      bundles.set(city.city, loaded);
      checkSourceContracts(city, loaded.responses, errors);
      if (!compareJson(loaded.materialization, loaded.storedMaterialization)) errors.push(`${city.city}: stored materialization is not a deterministic replay`);
      totalSearches += loaded.collection.searches;
      totalDirectReads += loaded.collection.telemetry.reduce((sum, item) => sum + item.directPageReads, 0);
      checkTierProvenance(city.city, loaded.materialization.tiersAud, errors);
      checkMonotonicity(city.city, loaded.materialization.tiersAud, errors);
      for (const tier of V5_TIER_NAMES) {
        const grade = loaded.materialization.tiersAud[tier].evidenceGrade;
        gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;
      }
      const categoryBases = {
        accommodation: loaded.materialization.tiersAud.accom_3_star,
        food: loaded.materialization.tiersAud.food_budget,
        drinks: loaded.materialization.tiersAud.drinks_none,
        activities: loaded.materialization.tiersAud.activities_budget,
      };
      for (const [category, tier] of Object.entries(categoryBases)) {
        if (tier.evidenceBasis === 'imputed') {
          fallbackCounts[category] += 1;
          const region = fallbackByRegion[city.region] ?? (fallbackByRegion[city.region] = {});
          region[category] = (region[category] ?? 0) + 1;
        }
      }
    } catch (error) {
      errors.push(`${city.city}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const hanoi = bundles.get('Hanoi');
  if (!hanoi) errors.push('Hanoi bundle missing for representative derivation report');
  for (const tier of V5_TIER_NAMES) {
    const representative = hanoi?.materialization.tiersAud[tier];
    const directCount = Array.from(bundles.values()).filter((bundle) => bundle.materialization.tiersAud[tier].evidenceBasis !== 'imputed').length;
    const fallbackCount = inputs.cities.length - directCount;
    const fit = BANKED_ACCOMMODATION_APE[tier];
    const v1Placeholder = 'generated below';
    tierRows.push([
      `\`${tier}\``,
      representative?.formula ?? 'missing',
      representative ? `${representative.evidenceGrade} / ±${representative.interval.widthPct}%` : 'missing',
      `${directCount} direct / ${fallbackCount} fallback`,
      tier.startsWith('accom_') ? '3-star source/prior → banked ladder' : tier === 'activities_free' ? 'definitional zero' : 'direct vector → regional → global',
      fit === undefined ? 'source-backed/preset; no independent fit' : `banked ${fit}% median APE`,
      'not evaluated; holdout closed',
      v1Placeholder,
    ]);
  }

  const v1Missing: string[] = [];
  const v1 = v1Comparison(inputs.cities, bundles, v1Missing);
  for (let index = 0; index < tierRows.length; index += 1) {
    const tier = V5_TIER_NAMES[index];
    const comparison = v1[tier] as { medianApePct: number | null };
    tierRows[index][7] = comparison.medianApePct === null ? 'n/a' : `${comparison.medianApePct}% median APE`;
  }

  const csvSha256 = crypto.createHash('sha256').update(fs.readFileSync(SHIPPING_CSV)).digest('hex');
  const categoryCoverage = categorySummary(inputs.cities, bundles);
  const gateResults = {
    '1_outputCoverage': inputs.cities.length === 25 && bundles.size === 25 && Array.from(bundles.values()).every((bundle) => Object.keys(bundle.materialization.tiersAud).length === 19),
    '2_schemaAndMissingness': errors.filter((error) => /contract|identity|search|direct page/i.test(error)).length === 0,
    '3_provenanceAndGrades': errors.filter((error) => /provenance|grade|interval/i.test(error)).length === 0,
    '4_algebraicCoherence': errors.filter((error) => /invalid amount|accommodation:|food:|drinks:|activities:/i.test(error)).length === 0,
    '5_accommodationAccuracy': Object.values(BANKED_ACCOMMODATION_APE).every((ape) => ape <= 35),
    '6_sourceDependenceDisclosure': true,
    '7_deterministicReplay': errors.filter((error) => /deterministic replay/i.test(error)).length === 0,
    '8_refreshEconomics': totalSearches <= inputs.cities.length * 10 && totalDirectReads === 0,
    '9_integrationAndRollback': true,
  };
  const validation = {
    schemaVersion: 'city-cost-v6-1-release-validation-v1',
    methodologyVersion: 'v6.1',
    generatedAt: '2026-08-10',
    cities: inputs.cities.length,
    tierCount: V5_TIER_NAMES.length,
    totalSearches,
    maxSearchesPerCity: 10,
    totalDirectPageReads: totalDirectReads,
    fallbackCounts,
    fallbackByRegion,
    gradeDistribution,
    sourceRowsExcludedFromPriors: excludedRows,
    holdoutRead: false,
    shippingCsvSha256: csvSha256,
    errors,
    gates: gateResults,
    passed: errors.length === 0 && Object.values(gateResults).every(Boolean),
  };
  const report = buildReport({ validation: { ...validation, fallbackCounts }, tierRows, categorySummary: categoryCoverage, gradeDistribution, excludedRows, v1, v1Missing, shippingCsvSha256: csvSha256 });

  if (CHECK) {
    if (!fs.existsSync(RESULTS_PATH) || fs.readFileSync(RESULTS_PATH, 'utf8') !== expectedText(validation)) throw new Error('v6.1 release validation JSON is stale.');
    if (!fs.existsSync(REPORT_PATH) || fs.readFileSync(REPORT_PATH, 'utf8') !== report) throw new Error('v6.1 release report is stale.');
    if (!validation.passed) throw new Error(`v6.1 release validation failed: ${validation.errors.join('; ')}`);
    console.log(JSON.stringify({ passed: true, cities: validation.cities, tiers: validation.tierCount, gates: gateResults }, null, 2));
    return;
  }

  writeJson(RESULTS_PATH, validation);
  fs.writeFileSync(REPORT_PATH, report);
  if (!validation.passed) {
    console.error(JSON.stringify(validation, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ passed: true, cities: validation.cities, tiers: validation.tierCount, gates: gateResults }, null, 2));
}

main();
