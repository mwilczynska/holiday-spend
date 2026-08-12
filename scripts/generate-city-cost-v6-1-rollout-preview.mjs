import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'data/reference/v6/experiments/008-v6-1-development-fixtures');
const MATERIALIZED_DIR = path.join(FIXTURE_DIR, 'materialized');
const SHIPPING_CSV = path.join(ROOT, 'data/reference/city_costs_app_aud.csv');
const OUT_JSON = path.join(ROOT, 'data/reference/v6/v6-1-rollout-preview.json');
const OUT_REPORT = path.join(ROOT, 'data/reference/v6/v6-1-rollout-preview.md');
const PROTOCOL_DIR = path.join(ROOT, 'data/reference/v6/experiments/009-v6-1-rollout-preview');
const PROTOCOL = path.join(PROTOCOL_DIR, 'protocol.md');
const GENERATED_AT = '2026-08-12';
const CHECK = process.argv.includes('--check');

const TIER_NAMES = [
  'accom_shared_hostel_dorm',
  'accom_hostel_private_room',
  'accom_1_star',
  'accom_2_star',
  'accom_3_star',
  'accom_4_star',
  'food_street_food',
  'food_budget',
  'food_mid_range',
  'food_high_end',
  'drink_coffee',
  'drinks_none',
  'drinks_light',
  'drinks_moderate',
  'drinks_heavy',
  'activities_free',
  'activities_budget',
  'activities_mid_range',
  'activities_high_end',
];

const BASKETS = {
  budget: {
    label: 'Representative budget',
    tiers: {
      accommodation: 'accom_shared_hostel_dorm',
      food: 'food_budget',
      drinks: 'drinks_none',
      activities: 'activities_budget',
    },
  },
  mid_range: {
    label: 'Representative mid-range',
    tiers: {
      accommodation: 'accom_2_star',
      food: 'food_mid_range',
      drinks: 'drinks_moderate',
      activities: 'activities_mid_range',
    },
  },
  high_end: {
    label: 'Representative high-end',
    tiers: {
      accommodation: 'accom_4_star',
      food: 'food_high_end',
      drinks: 'drinks_heavy',
      activities: 'activities_high_end',
    },
  },
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readShippingRows() {
  const parsed = Papa.parse(fs.readFileSync(SHIPPING_CSV, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) throw new Error(`Could not parse shipping CSV: ${JSON.stringify(parsed.errors)}`);
  return parsed.data;
}

function categoryForTier(tier) {
  if (tier.startsWith('accom_')) return 'accommodation';
  if (tier.startsWith('food_')) return 'food';
  if (tier.startsWith('drink')) return 'drinks';
  if (tier.startsWith('activities_')) return 'activities';
  throw new Error(`Unknown tier category: ${tier}`);
}

function numeric(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected numeric ${label}, got ${value}`);
  return parsed;
}

function compareValue(v1, v61) {
  const ratio = v1 > 0 ? v61 / v1 : null;
  const differencePct = v1 > 0 ? ((v61 - v1) / v1) * 100 : null;
  const flag = ratio !== null && ratio > 2
    ? 'above_2x_v1'
    : ratio !== null && ratio < 0.5
      ? 'below_0.5x_v1'
      : null;
  return {
    v1Aud: round(v1),
    v61Aud: round(v61),
    ratio: round(ratio, 4),
    differencePct: round(differencePct),
    flag,
  };
}

function summarizeComparisons(comparisons) {
  const comparable = comparisons.filter((item) => item.ratio !== null);
  const ratios = comparable.map((item) => item.ratio);
  const differences = comparable.map((item) => item.differencePct);
  const absoluteDifferences = differences.map((value) => Math.abs(value));
  return {
    comparableCities: comparable.length,
    medianV1Aud: round(median(comparable.map((item) => item.v1Aud))),
    medianV61Aud: round(median(comparable.map((item) => item.v61Aud))),
    medianRatio: round(median(ratios), 4),
    medianSignedDifferencePct: round(median(differences)),
    medianAbsoluteDifferencePct: round(median(absoluteDifferences)),
    p10SignedDifferencePct: round(percentile(differences, 0.1)),
    p90SignedDifferencePct: round(percentile(differences, 0.9)),
    minimumRatio: round(Math.min(...ratios), 4),
    maximumRatio: round(Math.max(...ratios), 4),
    above2xV1: comparable.filter((item) => item.ratio > 2).length,
    belowHalfV1: comparable.filter((item) => item.ratio < 0.5).length,
  };
}

function basketForCity(tiers, definition) {
  const categorySubtotals = Object.fromEntries(Object.entries(definition.tiers).map(([category, tier]) => [
    category,
    tiers[tier],
  ]));
  const v1 = Object.values(categorySubtotals).reduce((sum, value) => sum + value.v1Aud, 0);
  const v61 = Object.values(categorySubtotals).reduce((sum, value) => sum + value.v61Aud, 0);
  return {
    ...compareValue(v1, v61),
    categorySubtotals,
  };
}

function buildProtocol(csvHash, cityCount) {
  return `# Experiment 009 — v6.1 operational rollout preview

**Status:** generated, read-only comparison
**Generated:** ${GENERATED_AT}
**Purpose:** compare the operational v1 and v6.1 outputs before any new-city activation decision.

## Inputs

- v1 shipping dataset: data/reference/city_costs_app_aud.csv
- v1 CSV SHA-256: ${csvHash}
- v6.1 materializations: data/reference/v6/experiments/008-v6-1-development-fixtures/materialized/
- Cities compared: ${cityCount} existing development fixtures

The script makes no provider, web, collection, holdout or CSV-write calls. It does not use ground-truth
scores and is an operational impact comparison only.

## Comparison rule

For every one of the 19 planner tiers, compare the unchanged v1 CSV amount with the v6.1 materialized
amount for the same city. Report the ratio 'v6.1 / v1', signed percentage difference, medians and the
10th/90th-percentile signed-difference tails. A row is explicitly flagged when v6.1 is above 2x v1 or
below 0.5x v1. Zero-valued definitional rows are retained but have no ratio flag.

## Representative baskets

The three deterministic basket profiles are illustrative combinations, not new product tiers:

| Profile | Accommodation | Food | Drinks | Activities |
| --- | --- | --- | --- | --- |
| budget | accom_shared_hostel_dorm | food_budget | drinks_none | activities_budget |
| mid-range | accom_2_star | food_mid_range | drinks_moderate | activities_mid_range |
| high-end | accom_4_star | food_high_end | drinks_heavy | activities_high_end |

Each basket reports category subtotals and the total for v1 and v6.1. The profile definitions are held
fixed so the comparison cannot be tuned to the observed differences.

## Interpretation boundary

This preview describes operational level changes, not accuracy. It does not validate v6.1 against a new
truth source or turn source-backed proxies or modelled presets into independent observations. The owner has
approved a staged 121-city migration, but this preview alone does not satisfy the live canary or owner-review
requirements for cutover. Keep the live CSV unchanged until those steps are complete.
`;
}

function fmtAud(value) {
  return value === null ? '—' : `A$${value.toFixed(2)}`;
}

function fmtPct(value) {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function fmtRatio(value) {
  return value === null ? '—' : `${value.toFixed(2)}x`;
}

function buildReport(result) {
  const lines = [
    '# v6.1 operational rollout preview',
    '',
    `**Generated:** ${result.generatedAt}  `,
    '**Status:** read-only operational comparison; not ground-truth validation',
    '',
    '## Recommendation',
    '',
    `**${result.recommendation.decision}** — ${result.recommendation.text}`,
    '',
    'Runtime >=95% coverage remains unmeasured, and food/activity source dependence plus drink preset',
    'assumptions remain disclosed evidence limitations. This preview must not be used to tune v6.1 to',
    'the incumbent CSV or to justify migrating existing cities.',
    '',
    '## Inputs and invariants',
    '',
    `- Development fixtures: ${result.inputs.cityCount} cities × ${result.inputs.tierCount} tiers`,
    `- Shipping CSV rows: ${result.inputs.shippingCsvRows}`,
    `- Shipping CSV SHA-256: ${result.inputs.shippingCsvSha256}`,
    '- Holdout: untouched',
    '- Shipping CSV: read-only; unchanged',
    '',
    '## Representative baskets',
    '',
    '| Profile | v1 total | v6.1 total | median ratio | median signed difference | p10 → p90 difference | flagged cities |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [profile, summary] of Object.entries(result.basketSummaries)) {
    lines.push(`| ${BASKETS[profile].label} | ${fmtAud(summary.medianV1Aud)} | ${fmtAud(summary.medianV61Aud)} | ${fmtRatio(summary.medianRatio)} | ${fmtPct(summary.medianSignedDifferencePct)} | ${fmtPct(summary.p10SignedDifferencePct)} → ${fmtPct(summary.p90SignedDifferencePct)} | ${summary.above2xV1 + summary.belowHalfV1} |`);
  }
  lines.push('', 'Category subtotals are included for every city and basket in the JSON artifact.', '', '## Per-tier comparison', '', '| Tier | v1 median | v6.1 median | median ratio | median signed difference | p10 → p90 difference | >2x | <0.5x |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const summary of Object.values(result.tierSummaries)) {
    lines.push(`| ${summary.tier} | ${fmtAud(summary.medianV1Aud)} | ${fmtAud(summary.medianV61Aud)} | ${fmtRatio(summary.medianRatio)} | ${fmtPct(summary.medianSignedDifferencePct)} | ${fmtPct(summary.p10SignedDifferencePct)} → ${fmtPct(summary.p90SignedDifferencePct)} | ${summary.above2xV1} | ${summary.belowHalfV1} |`);
  }
  lines.push('', '## Explicit >2x / <0.5x flags', '');
  if (!result.flags.length) {
    lines.push('No non-zero comparable tier or representative basket crossed a flag threshold.');
  } else {
    lines.push('| City | Scope | Name | v1 | v6.1 | Ratio | Difference |', '| --- | --- | --- | ---: | ---: | ---: | ---: |');
    for (const flag of result.flags) {
      lines.push(`| ${flag.city} | ${flag.scope} | ${flag.name} | ${fmtAud(flag.v1Aud)} | ${fmtAud(flag.v61Aud)} | ${fmtRatio(flag.ratio)} | ${fmtPct(flag.differencePct)} |`);
    }
  }
  lines.push('', '## Per-city detail', '', 'The JSON artifact contains every city × tier v1/v6.1 pair, all basket category subtotals, flags and provenance inputs:', '', 'data/reference/v6/v6-1-rollout-preview.json', '', '## Decision boundary', '', 'This artifact is an operational A/B preview. It is not a holdout score and it does not establish absolute accuracy. A staged 121-city migration is approved in principle, but the live provider canary, complete staged artifact and owner review are still required. The existing v1 path remains the rollback when CITY_COST_METHODOLOGY_V6 is unset.', '');
  return `${lines.join('\n')}\n`;
}

function build() {
  const shippingRows = readShippingRows();
  const shippingByCity = new Map(shippingRows.map((row) => [row.city, row]));
  const fixtureFiles = fs.readdirSync(MATERIALIZED_DIR).filter((file) => file.endsWith('.json')).sort();
  const cities = [];
  for (const file of fixtureFiles) {
    const fixture = readJson(path.join(MATERIALIZED_DIR, file));
    const row = shippingByCity.get(fixture.city);
    if (!row) throw new Error(`Shipping CSV has no row for fixture city ${fixture.city}`);
    if (fixture.methodologyVersion !== 'v6.1') throw new Error(`Fixture ${file} is not v6.1`);
    const materialized = fixture.materialization?.tiersAud;
    if (!materialized) throw new Error(`Fixture ${file} has no materialized tiers`);
    const tiers = {};
    for (const tier of TIER_NAMES) {
      const v1 = numeric(row[tier], `${fixture.city}.${tier} v1`);
      const v61 = numeric(materialized[tier]?.amountAud, `${fixture.city}.${tier} v6.1`);
      tiers[tier] = compareValue(v1, v61);
    }
    const baskets = Object.fromEntries(Object.entries(BASKETS).map(([profile, definition]) => [profile, basketForCity(tiers, definition)]));
    cities.push({
      city: fixture.city,
      country: fixture.country,
      region: fixture.region,
      costBand: fixture.band ?? fixture.materialization.costBand ?? null,
      tiers,
      baskets,
    });
  }
  if (cities.length !== 25) throw new Error(`Expected 25 development fixtures, found ${cities.length}`);

  const tierSummaries = Object.fromEntries(TIER_NAMES.map((tier) => [
    tier,
    { tier, category: categoryForTier(tier), ...summarizeComparisons(cities.map((city) => city.tiers[tier])) },
  ]));
  const basketSummaries = Object.fromEntries(Object.keys(BASKETS).map((profile) => [
    profile,
    summarizeComparisons(cities.map((city) => city.baskets[profile])),
  ]));
  const flags = [];
  for (const city of cities) {
    for (const [tier, comparison] of Object.entries(city.tiers)) {
      if (comparison.flag) flags.push({ city: city.city, scope: 'tier', name: tier, ...comparison });
    }
    for (const [profile, comparison] of Object.entries(city.baskets)) {
      if (comparison.flag) flags.push({ city: city.city, scope: 'basket', name: profile, ...comparison });
    }
  }
  const csvHash = sha256(SHIPPING_CSV);
  const result = {
    schemaVersion: 'city-cost-v6-1-rollout-preview-v1',
    methodologyVersion: 'v6.1',
    generatedAt: GENERATED_AT,
    purpose: 'Operational v1 versus v6.1 comparison before staged 121-city migration and cutover review; not ground-truth validation.',
    inputs: {
      developmentFixtureDirectory: 'data/reference/v6/experiments/008-v6-1-development-fixtures/materialized/',
      shippingCsv: 'data/reference/city_costs_app_aud.csv',
      shippingCsvSha256: csvHash,
      shippingCsvRows: shippingRows.length,
      cityCount: cities.length,
      tierCount: TIER_NAMES.length,
      tierNames: TIER_NAMES,
      holdoutAccessed: false,
      networkCalls: 0,
    },
    basketDefinitions: BASKETS,
    tierSummaries,
    basketSummaries,
    flags,
    cities,
    recommendation: {
      decision: 'recommend staged 121-city migration after runtime canary and owner review',
      text: 'The owner has approved migration in principle. Use this preview as operational context, then require the live provider canary and a complete staged 121-city artifact before cutover. Keep the live CSV on v1 until owner approval and retain the coordinated v1 rollback.',
      limitations: [
        'Runtime >=95% coverage is unmeasured.',
        'This is not ground-truth validation and should not be interpreted as accuracy.',
        'Food and activity values are BudgetYourTrip source-backed product estimates; drinks are Numbeo-backed consumption presets with modelled cocktail composition.',
      ],
    },
  };
  return {
    result,
    protocol: buildProtocol(csvHash, cities.length),
    report: buildReport(result),
  };
}

function writeOrCheck(file, content) {
  if (CHECK) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw new Error(`${file} is stale; run without --check.`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const { result, protocol, report } = build();
writeOrCheck(OUT_JSON, `${JSON.stringify(result, null, 2)}\n`);
writeOrCheck(OUT_REPORT, report);
writeOrCheck(PROTOCOL, protocol);
if (!CHECK) console.log(JSON.stringify({ passed: true, cities: result.inputs.cityCount, tiers: result.inputs.tierCount, flags: result.flags.length, shippingCsvSha256: result.inputs.shippingCsvSha256 }, null, 2));
else console.log(JSON.stringify({ passed: true, cities: result.inputs.cityCount, tiers: result.inputs.tierCount, flags: result.flags.length }, null, 2));
