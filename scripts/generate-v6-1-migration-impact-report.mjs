import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const MIGRATION = path.join(ROOT, 'data/reference/v6/migration-v6-1');
const PROTOCOL_FILE = path.join(MIGRATION, 'protocol.json');
const MATERIALIZED_DIR = path.join(MIGRATION, 'materialized');
const STAGED_CSV = path.join(MIGRATION, 'staged/city_costs_app_aud.v6-1.staged.csv');
const SIDECAR = path.join(MIGRATION, 'staged/provenance-sidecar.json');
const IMPORT_PLAN = path.join(MIGRATION, 'staged/provenance-import-plan.json');
const V1_CSV = path.join(ROOT, 'data/reference/city_costs_app_aud.csv');
const OUT_JSON = path.join(MIGRATION, 'impact-report.json');
const OUT_MD = path.join(MIGRATION, 'impact-report.md');
const CHECK = process.argv.includes('--check');

const TIERS = [
  'accom_shared_hostel_dorm', 'accom_hostel_private_room', 'accom_1_star', 'accom_2_star', 'accom_3_star', 'accom_4_star',
  'food_street_food', 'food_budget', 'food_mid_range', 'food_high_end',
  'drink_coffee', 'drinks_none', 'drinks_light', 'drinks_moderate', 'drinks_heavy',
  'activities_free', 'activities_budget', 'activities_mid_range', 'activities_high_end',
];

const BASKETS = {
  budget: {
    accommodation: 'accom_shared_hostel_dorm', food: 'food_budget', drinks: 'drinks_none', activities: 'activities_budget',
  },
  mid_range: {
    accommodation: 'accom_2_star', food: 'food_mid_range', drinks: 'drinks_moderate', activities: 'activities_mid_range',
  },
  high_end: {
    accommodation: 'accom_4_star', food: 'food_high_end', drinks: 'drinks_heavy', activities: 'activities_high_end',
  },
};

const CSV_COLUMNS = [
  'city', 'country', 'region', ...TIERS,
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function numeric(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Expected non-negative numeric ${label}, got ${value}`);
  return parsed;
}

function categoryForTier(tier) {
  if (tier.startsWith('accom_')) return 'accommodation';
  if (tier.startsWith('food_')) return 'food';
  if (tier.startsWith('drink')) return 'drinks';
  if (tier.startsWith('activities_')) return 'activities';
  throw new Error(`Unknown tier: ${tier}`);
}

function compare(v1, v61) {
  const ratio = v1 > 0 ? v61 / v1 : null;
  const differencePct = v1 > 0 ? ((v61 - v1) / v1) * 100 : null;
  const flag = ratio !== null && ratio > 2 ? 'above_2x_v1' : ratio !== null && ratio < 0.5 ? 'below_0.5x_v1' : null;
  return { v1Aud: round(v1), v61Aud: round(v61), ratio: round(ratio, 4), differencePct: round(differencePct), flag };
}

function summarize(items) {
  const comparable = items.filter((item) => item.ratio !== null);
  const signed = comparable.map((item) => item.differencePct);
  const ratios = comparable.map((item) => item.ratio);
  return {
    comparableCities: comparable.length,
    medianV1Aud: round(median(comparable.map((item) => item.v1Aud))),
    medianV61Aud: round(median(comparable.map((item) => item.v61Aud))),
    medianRatio: round(median(ratios), 4),
    medianSignedDifferencePct: round(median(signed)),
    medianAbsoluteDifferencePct: round(median(signed.map((value) => Math.abs(value)))),
    p10SignedDifferencePct: round(percentile(signed, 0.1)),
    p90SignedDifferencePct: round(percentile(signed, 0.9)),
    minimumRatio: comparable.length ? round(Math.min(...ratios), 4) : null,
    maximumRatio: comparable.length ? round(Math.max(...ratios), 4) : null,
    above2xV1: comparable.filter((item) => item.ratio > 2).length,
    belowHalfV1: comparable.filter((item) => item.ratio < 0.5).length,
  };
}

function rankCities(cities, valueFn) {
  return [...cities]
    .sort((left, right) => valueFn(right) - valueFn(left) || left.city.localeCompare(right.city))
    .map((city, index) => ({ city: city.city, rank: index + 1, value: round(valueFn(city)) }));
}

function spearman(left, right) {
  const n = left.length;
  if (n < 2) return null;
  const rightByCity = new Map(right.map((item) => [item.city, item.rank]));
  const sumSquares = left.reduce((sum, item) => sum + (item.rank - rightByCity.get(item.city)) ** 2, 0);
  return round(1 - (6 * sumSquares) / (n * (n ** 2 - 1)), 4);
}

function readCsv(file) {
  const parsed = Papa.parse(fs.readFileSync(file, 'utf8'), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Could not parse ${file}: ${JSON.stringify(parsed.errors)}`);
  if (JSON.stringify(parsed.meta.fields) !== JSON.stringify(CSV_COLUMNS)) throw new Error(`Unexpected CSV columns in ${file}.`);
  return parsed.data;
}

function verifyUnique(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.city)) throw new Error(`Duplicate ${label} city: ${row.city}`);
    seen.add(row.city);
  }
}

function readMaterialized(protocol) {
  const files = fs.readdirSync(MATERIALIZED_DIR).filter((file) => file.endsWith('.json')).sort();
  if (files.length !== protocol.frame.length) throw new Error(`Expected ${protocol.frame.length} materialized cities, found ${files.length}.`);
  const frameByCity = new Map(protocol.frame.map((city) => [city.city, city]));
  const rows = files.map((file) => {
    const value = readJson(path.join(MATERIALIZED_DIR, file));
    const frame = frameByCity.get(value.city?.city);
    if (!frame) throw new Error(`Materialization ${file} is not in the frozen frame.`);
    if (value.methodologyVersion !== 'v6.1' || value.provenance?.methodologyVersion !== 'v6.1') throw new Error(`Invalid v6.1 materialization: ${file}`);
    if (value.city.country !== frame.country || value.city.region !== frame.region) throw new Error(`Frame identity drift: ${frame.city}`);
    const tiers = value.materialization?.tiersAud;
    if (!tiers || Object.keys(tiers).length !== TIERS.length) throw new Error(`Incomplete tier set: ${frame.city}`);
    const normalizedTiers = {};
    for (const tier of TIERS) {
      const item = tiers[tier];
      if (!item || item.amountAud === null || item.amountAud === undefined) throw new Error(`Missing ${frame.city}/${tier}`);
      const amountAud = numeric(item.amountAud, `${frame.city}/${tier}`);
      normalizedTiers[tier] = {
        amountAud,
        evidenceBasis: item.evidenceBasis,
        evidenceGrade: item.evidenceGrade,
        interval: item.interval,
        imputedMeasures: item.imputedMeasures ?? [],
      };
    }
    return { city: frame.city, country: frame.country, region: frame.region, cityId: frame.cityId, tiers: normalizedTiers, provenance: value.provenance };
  });
  verifyUnique(rows, 'materialized');
  return rows;
}

function categoryEvidence(cities) {
  const result = {};
  for (const city of cities) {
    result[city.region] ??= {};
    for (const [tier, value] of Object.entries(city.tiers)) {
      const category = categoryForTier(tier);
      for (const target of [result, result[city.region]]) {
        target[category] ??= { observations: 0, direct: 0, fallback: 0, grades: {} };
        target[category].observations += 1;
        if (value.evidenceBasis === 'imputed' || value.evidenceGrade === 'D') target[category].fallback += 1;
        else target[category].direct += 1;
        target[category].grades[value.evidenceGrade] = (target[category].grades[value.evidenceGrade] ?? 0) + 1;
      }
    }
  }
  return result;
}

function allPrior(city) {
  return TIERS.filter((tier) => tier !== 'activities_free').every((tier) => city.tiers[tier].evidenceBasis === 'imputed' || city.tiers[tier].evidenceGrade === 'D');
}

function build() {
  const protocol = readJson(PROTOCOL_FILE);
  if (protocol.frame.length !== 121) throw new Error(`Frozen frame has ${protocol.frame.length} cities.`);
  const v1Rows = readCsv(V1_CSV);
  const stagedRows = readCsv(STAGED_CSV);
  if (v1Rows.length !== 121 || stagedRows.length !== 121) throw new Error(`Expected 121 rows in both CSVs; found ${v1Rows.length}/${stagedRows.length}.`);
  verifyUnique(v1Rows, 'v1 CSV');
  verifyUnique(stagedRows, 'staged CSV');
  const v1ByCity = new Map(v1Rows.map((row) => [row.city, row]));
  const stagedByCity = new Map(stagedRows.map((row) => [row.city, row]));
  const frameCities = new Set(protocol.frame.map((city) => city.city));
  for (const city of frameCities) {
    if (!v1ByCity.has(city) || !stagedByCity.has(city)) throw new Error(`Missing frozen-frame city from CSVs: ${city}`);
  }
  for (const row of [...v1Rows, ...stagedRows]) if (!frameCities.has(row.city)) throw new Error(`CSV city is outside frozen frame: ${row.city}`);
  const cities = readMaterialized(protocol);
  const materializedByCity = new Map(cities.map((city) => [city.city, city]));
  const cityReports = cities.map((city) => {
    const v1 = v1ByCity.get(city.city);
    const staged = stagedByCity.get(city.city);
    const tiers = {};
    for (const tier of TIERS) {
      const v1Amount = numeric(v1[tier], `${city.city}/${tier} v1`);
      const stagedAmount = numeric(staged[tier], `${city.city}/${tier} staged`);
      if (Math.abs(stagedAmount - city.tiers[tier].amountAud) > 0.001) throw new Error(`Staged/materialized mismatch: ${city.city}/${tier}`);
      tiers[tier] = { ...compare(v1Amount, stagedAmount), evidenceGrade: city.tiers[tier].evidenceGrade, evidenceBasis: city.tiers[tier].evidenceBasis, interval: city.tiers[tier].interval, imputedMeasures: city.tiers[tier].imputedMeasures };
    }
    const baskets = {};
    for (const [profile, definition] of Object.entries(BASKETS)) {
      const categorySubtotals = {};
      for (const [category, tier] of Object.entries(definition)) {
        categorySubtotals[category] = { ...compare(numeric(v1[tier], `${city.city}/${tier} v1`), numeric(staged[tier], `${city.city}/${tier} staged`)), tier };
      }
      const v1Total = Object.values(categorySubtotals).reduce((sum, value) => sum + value.v1Aud, 0);
      const v61Total = Object.values(categorySubtotals).reduce((sum, value) => sum + value.v61Aud, 0);
      baskets[profile] = { ...compare(v1Total, v61Total), categorySubtotals };
    }
    return { city: city.city, country: city.country, region: city.region, cityId: city.cityId, allPrior: allPrior(city), tiers, baskets };
  });
  const tierSummaries = Object.fromEntries(TIERS.map((tier) => [tier, { tier, category: categoryForTier(tier), ...summarize(cityReports.map((city) => city.tiers[tier])) }]));
  const basketSummaries = Object.fromEntries(Object.keys(BASKETS).map((profile) => [profile, summarize(cityReports.map((city) => city.baskets[profile]))]));
  const flags = [];
  for (const city of cityReports) {
    for (const [tier, value] of Object.entries(city.tiers)) if (value.flag) flags.push({ city: city.city, scope: 'tier', name: tier, ...value });
    for (const [profile, value] of Object.entries(city.baskets)) if (value.flag) flags.push({ city: city.city, scope: 'basket', name: profile, ...value });
  }
  const ranking = {};
  for (const profile of Object.keys(BASKETS)) {
    const v1Ranking = rankCities(cityReports, (city) => city.baskets[profile].v1Aud);
    const v61Ranking = rankCities(cityReports, (city) => city.baskets[profile].v61Aud);
    const v61ByCity = new Map(v61Ranking.map((item) => [item.city, item]));
    ranking[profile] = { spearman: spearman(v1Ranking, v61Ranking), changedOrderCount: v1Ranking.filter((item) => item.rank !== v61ByCity.get(item.city).rank).length, top10V1: v1Ranking.slice(0, 10), top10V61: v61Ranking.slice(0, 10), rankChanges: v1Ranking.map((item) => ({ city: item.city, v1Rank: item.rank, v61Rank: v61ByCity.get(item.city).rank, delta: v61ByCity.get(item.city).rank - item.rank })) };
  }
  const artifactReports = fs.readdirSync(path.join(MIGRATION, 'batches')).filter((file) => file.startsWith('phase9-batch-') && file.endsWith('.json')).sort().flatMap((file) => {
    const report = readJson(path.join(MIGRATION, 'batches', file));
    return (report.artifactRows ?? []).filter((row) => row.artifactCandidate).map((row) => ({ batchId: report.batchId, ...row }));
  });
  const checks = {
    v1RowCount: v1Rows.length === 121,
    stagedRowCount: stagedRows.length === 121,
    uniqueV1Cities: new Set(v1Rows.map((row) => row.city)).size === 121,
    uniqueStagedCities: new Set(stagedRows.map((row) => row.city)).size === 121,
    frozenFrameIdentity: cities.length === 121,
    allTiersPresent: cities.every((city) => Object.keys(city.tiers).length === TIERS.length),
    nonNegative: cities.every((city) => Object.values(city.tiers).every((tier) => tier.amountAud >= 0)),
    noDuplicateMaterializations: new Set(cities.map((city) => city.cityId)).size === 121,
    missingRows: [...frameCities].filter((city) => !materializedByCity.has(city)),
  };
  if (Object.values(checks).some((value) => value === false) || checks.missingRows.length) throw new Error(`Migration integrity checks failed: ${JSON.stringify(checks)}`);
  if (!fs.existsSync(SIDECAR) || !fs.existsSync(IMPORT_PLAN)) throw new Error('Provenance sidecar/import plan is missing.');
  const sidecar = readJson(SIDECAR);
  if (sidecar.completeCities !== 121 || sidecar.rows?.length !== 121) throw new Error('Provenance sidecar is incomplete.');
  const result = {
    schemaVersion: 'city-cost-v6-1-migration-impact-report-v1', methodologyVersion: 'v6.1', generatedAt: protocol.registeredAt,
    purpose: 'Complete operational v1 versus v6.1 comparison for the staged 121-city migration; not ground-truth validation.',
    inputs: { frozenProtocol: 'data/reference/v6/migration-v6-1/protocol.json', protocolSha256: sha256(PROTOCOL_FILE), v1Csv: 'data/reference/city_costs_app_aud.csv', v1CsvSha256: sha256(V1_CSV), stagedCsv: 'data/reference/v6/migration-v6-1/staged/city_costs_app_aud.v6-1.staged.csv', stagedCsvSha256: sha256(STAGED_CSV), provenanceSidecar: 'data/reference/v6/migration-v6-1/staged/provenance-sidecar.json', provenanceSidecarSha256: sha256(SIDECAR), importPlan: 'data/reference/v6/migration-v6-1/staged/provenance-import-plan.json', importPlanSha256: sha256(IMPORT_PLAN), cityCount: 121, tierCount: 19, holdoutAccessed: false, liveCsvWritten: false },
    basketDefinitions: BASKETS, tierSummaries, basketSummaries, categoryEvidence: categoryEvidence(cities), artifactCandidates: artifactReports, flags, ranking, checks, cities: cityReports,
    recommendation: { decision: 'owner review required before Phase 11', text: 'The complete staged artifact is ready for operational review only. It must not replace the live CSV or change the new-city default until the owner reviews impact, the user-key smoke passes, and cutover/rollback are approved.' },
  };
  const markdown = buildMarkdown(result);
  return { result, markdown };
}

function money(value) { return value === null ? '-' : `A$${Number(value).toFixed(2)}`; }
function pct(value) { return value === null ? '-' : `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`; }

function buildMarkdown(result) {
  const lines = ['# v6.1 staged migration impact report', '', `**Generated:** ${result.generatedAt}`, '**Status:** complete operational comparison; not ground-truth validation', '', '## Inputs and integrity', '', `- Cities: ${result.inputs.cityCount} x ${result.inputs.tierCount} tiers`, `- v1 CSV SHA-256: ${result.inputs.v1CsvSha256}`, `- staged CSV SHA-256: ${result.inputs.stagedCsvSha256}`, `- provenance sidecar SHA-256: ${result.inputs.provenanceSidecarSha256}`, `- import plan SHA-256: ${result.inputs.importPlanSha256}`, '- Holdout: untouched', '- Live CSV: untouched', '', '## Representative baskets', '', '| Profile | v1 median | v6.1 median | median ratio | median signed difference | p10 to p90 | flags |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const [profile, summary] of Object.entries(result.basketSummaries)) lines.push(`| ${profile} | ${money(summary.medianV1Aud)} | ${money(summary.medianV61Aud)} | ${summary.medianRatio ?? '-'}x | ${pct(summary.medianSignedDifferencePct)} | ${pct(summary.p10SignedDifferencePct)} to ${pct(summary.p90SignedDifferencePct)} | ${summary.above2xV1 + summary.belowHalfV1} |`);
  lines.push('', '## Per-tier impact', '', '| Tier | v1 median | v6.1 median | ratio | signed difference | p10 to p90 | >2x | <0.5x |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const summary of Object.values(result.tierSummaries)) lines.push(`| ${summary.tier} | ${money(summary.medianV1Aud)} | ${money(summary.medianV61Aud)} | ${summary.medianRatio ?? '-'}x | ${pct(summary.medianSignedDifferencePct)} | ${pct(summary.p10SignedDifferencePct)} to ${pct(summary.p90SignedDifferencePct)} | ${summary.above2xV1} | ${summary.belowHalfV1} |`);
  lines.push('', '## Evidence and fallback distribution', '', 'The JSON artifact contains category and region distributions of evidence grades and direct/fallback values. Batch artifact candidates are retained below.', '');
  if (!result.artifactCandidates.length) lines.push('No all-prior artifact candidates were recorded.');
  else for (const item of result.artifactCandidates) lines.push(`- ${item.batchId}: ${item.city} - ${item.reason}`);
  lines.push('', '## Ranking diagnostics', '', '| Basket | Spearman rank correlation | Cities changing rank |', '| --- | ---: | ---: |');
  for (const [profile, value] of Object.entries(result.ranking)) lines.push(`| ${profile} | ${value.spearman ?? '-'} | ${value.changedOrderCount} |`);
  lines.push('', '## Explicit extreme flags', '');
  if (!result.flags.length) lines.push('No tier or representative basket crossed the >2x or <0.5x threshold.');
  else { lines.push('| City | Scope | Name | v1 | v6.1 | Ratio | Difference |', '| --- | --- | --- | ---: | ---: | ---: | ---: |'); for (const flag of result.flags) lines.push(`| ${flag.city} | ${flag.scope} | ${flag.name} | ${money(flag.v1Aud)} | ${money(flag.v61Aud)} | ${flag.ratio}x | ${pct(flag.differencePct)} |`); }
  lines.push('', '## Cutover boundary', '', 'This report is an operational impact comparison, not a validation score. Review the staged CSV, provenance sidecar, fallback concentration, extreme flags and ranking changes before Phase 11. Cutover must move the CSV, provenance import and new-city default together; rollback must restore the v1 CSV and v1 default together.', '');
  return `${lines.join('\n')}\n`;
}

const { result, markdown } = build();
const jsonText = `${JSON.stringify(result, null, 2)}\n`;
if (CHECK) {
  if (!fs.existsSync(OUT_JSON) || fs.readFileSync(OUT_JSON, 'utf8') !== jsonText) throw new Error('Impact JSON is stale; run without --check.');
  if (!fs.existsSync(OUT_MD) || fs.readFileSync(OUT_MD, 'utf8') !== markdown) throw new Error('Impact Markdown is stale; run without --check.');
  console.log(JSON.stringify({ passed: true, command: 'check', cities: 121, tiers: 19, flags: result.flags.length }, null, 2));
} else {
  fs.mkdirSync(MIGRATION, { recursive: true });
  fs.writeFileSync(OUT_JSON, jsonText);
  fs.writeFileSync(OUT_MD, markdown);
  console.log(JSON.stringify({ passed: true, command: 'generate', cities: 121, tiers: 19, flags: result.flags.length, v1CsvSha256: result.inputs.v1CsvSha256, stagedCsvSha256: result.inputs.stagedCsvSha256 }, null, 2));
}
