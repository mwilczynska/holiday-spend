import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const MIGRATION = path.join(ROOT, 'data/reference/v6/migration-v6-1');
const protocol = JSON.parse(fs.readFileSync(path.join(MIGRATION, 'protocol.json'), 'utf8'));
const materializedDir = path.join(MIGRATION, 'materialized');
const batchId = option('batch-id') ?? 'batch-unknown';
const citiesArg = option('cities');
const selectedNames = citiesArg ? citiesArg.split(',').map((value) => value.trim()).filter(Boolean) : [];

function option(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readCity(city) {
  const file = path.join(materializedDir, `${slug(city.city)}.json`);
  const normalizedFile = path.join(MIGRATION, 'normalized', `${slug(city.city)}.json`);
  if (!fs.existsSync(file)) throw new Error(`Materialized city is missing: ${city.city}`);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!fs.existsSync(normalizedFile)) throw new Error(`Normalized city is missing: ${city.city}`);
  value.normalized = JSON.parse(fs.readFileSync(normalizedFile, 'utf8'));
  if (value.methodologyVersion !== 'v6.1' || value.provenance?.methodologyVersion !== 'v6.1') throw new Error(`Invalid v6.1 materialization: ${city.city}`);
  return { file, value };
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function categoryCounts(rows) {
  const categories = { accommodation: 'accom_3_star', food: 'food_budget', drinks: 'drinks_none', activities: 'activities_budget' };
  const result = Object.fromEntries(Object.keys(categories).map((key) => [key, { direct: 0, fallback: 0 }]));
  for (const row of rows) {
    for (const [category, tier] of Object.entries(categories)) {
      const value = row.value.materialization.tiersAud[tier];
      if (!value) throw new Error(`Category representative tier is missing: ${row.value.city.city}/${tier}`);
      if (value.evidenceBasis === 'imputed') result[category].fallback += 1;
      else result[category].direct += 1;
    }
  }
  return result;
}

function artifactFor(row) {
  const tiers = Object.entries(row.value.materialization.tiersAud).filter(([tier]) => tier !== 'activities_free').map(([, value]) => value);
  const allPrior = tiers.length === 0 || tiers.every((tier) => tier.evidenceBasis === 'imputed' || tier.evidenceGrade === 'D');
  return allPrior ? { artifactCandidate: true, reason: 'all non-definitional tiers are fallback/imputed or grade D' } : { artifactCandidate: false, reason: null };
}

function buildReport() {
  const frameCities = protocol.frame.filter((city) => !selectedNames.length || selectedNames.includes(city.city));
  if (!frameCities.length) throw new Error('No migration cities selected.');
  const rows = frameCities.map((city) => readCity(city));
  const artifactRows = rows.map((row) => ({ city: row.value.city.city, ...artifactFor(row) }));
  const grades = {};
  const observedMeasures = {};
  const sourceStatuses = {};
  const collectionModes = {};
  let searches = 0;
  let retries = 0;
  let directPageReads = 0;
  let calls = 0;
  for (const row of rows) {
    for (const tier of Object.values(row.value.materialization.tiersAud)) increment(grades, tier.evidenceGrade);
    for (const fact of row.value.normalized.collection.facts ?? []) {
      if (fact.status === 'observed') increment(observedMeasures, fact.measure);
      const key = `${fact.source}:${fact.retrievalStatus}`;
      increment(sourceStatuses, key);
    }
    for (const call of row.value.provenance.calls ?? []) {
      calls += 1;
      collectionModes[call.collectionMode] = (collectionModes[call.collectionMode] ?? 0) + 1;
      const telemetry = row.value.normalized.collection.telemetry.find((item) => item.source === call.source);
      searches += telemetry?.searchesUsed ?? 0;
      retries += telemetry?.retries ?? 0;
      directPageReads += telemetry?.directPageReads ?? 0;
    }
  }
  const artifactCandidates = artifactRows.filter((row) => row.artifactCandidate).length;
  return {
    schemaVersion: 'city-cost-v6-1-migration-batch-report-v1',
    batchId,
    generatedAt: 'deterministic',
    protocolSha256: sha256File(path.join(MIGRATION, 'protocol.json')),
    inputCsvSha256: protocol.inputCsvSha256,
    cities: frameCities.map((city) => city.city),
    cityCount: rows.length,
    completeMaterializations: rows.length,
    calls,
    searches,
    retries,
    directPageReads,
    collectionModes,
    observedMeasures,
    sourceStatuses,
    categoryCounts: categoryCounts(rows),
    gradeDistribution: grades,
    allPriorCities: artifactCandidates,
    artifactCandidates,
    artifactFraction: artifactCandidates / rows.length,
    artifactRows,
  };
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const outputDir = path.join(MIGRATION, 'batches');
const jsonFile = path.join(outputDir, `${batchId}.json`);
const markdownFile = path.join(outputDir, `${batchId}.md`);
const report = buildReport();
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdown = `# v6.1 migration ${report.batchId}\n\n`+
  `Generated from the frozen migration artifacts; this is operational staging evidence, not ground-truth validation.\n\n`+
  `- Cities: ${report.cityCount}\n- Complete materializations: ${report.completeMaterializations}\n`+
  `- Calls / searches / retries / direct reads: ${report.calls} / ${report.searches} / ${report.retries} / ${report.directPageReads}\n`+
  `- Artifact candidates: ${report.artifactCandidates}/${report.cityCount} (${(report.artifactFraction * 100).toFixed(1)}%)\n`+
  `- Category direct/fallback: \`${JSON.stringify(report.categoryCounts)}\`\n`+
  `- Grade distribution: \`${JSON.stringify(report.gradeDistribution)}\`\n`+
  `- Collection modes: \`${JSON.stringify(report.collectionModes)}\`\n\n`+
  `Artifact rows: ${report.artifactRows.filter((row) => row.artifactCandidate).map((row) => `${row.city} (${row.reason})`).join('; ') || 'none'}.\n`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(jsonFile) || fs.readFileSync(jsonFile, 'utf8') !== jsonText) throw new Error(`Batch JSON is stale: ${jsonFile}`);
  if (!fs.existsSync(markdownFile) || fs.readFileSync(markdownFile, 'utf8') !== markdown) throw new Error(`Batch Markdown is stale: ${markdownFile}`);
} else {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonFile, jsonText);
  fs.writeFileSync(markdownFile, markdown);
}

console.log(JSON.stringify({ passed: true, batchId, cities: report.cityCount, completeMaterializations: report.completeMaterializations, artifactCandidates: report.artifactCandidates, artifactFraction: report.artifactFraction, calls: report.calls, searches: report.searches, retries: report.retries, directPageReads: report.directPageReads }, null, 2));
