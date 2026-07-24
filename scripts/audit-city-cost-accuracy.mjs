import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const inputPath = path.resolve(
  process.cwd(),
  process.argv[2] || path.join('data', 'reference', 'accuracy_audit.csv')
);

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    const group = groups.get(value) || [];
    group.push(row);
    groups.set(value, group);
    return groups;
  }, new Map());
}

function summarize(rows) {
  const signedErrors = rows.map((row) => row.dbUsd - row.referenceUsd);
  const percentageErrors = rows.map((row) => row.pctError);
  const absolutePercentageErrors = percentageErrors.map(Math.abs);
  const sumReference = rows.reduce((sum, row) => sum + row.referenceUsd, 0);
  const sumAbsoluteError = signedErrors.reduce((sum, value) => sum + Math.abs(value), 0);

  return {
    n: rows.length,
    mapePct: round(mean(absolutePercentageErrors)),
    medianApePct: round(median(absolutePercentageErrors)),
    meanBiasPct: round(mean(percentageErrors)),
    medianBiasPct: round(median(percentageErrors)),
    wapePct: round((sumAbsoluteError / sumReference) * 100),
    rmseUsd: round(Math.sqrt(mean(signedErrors.map((value) => value ** 2)))),
    rmspePct: round(Math.sqrt(mean(percentageErrors.map((value) => value ** 2)))),
    within10Pct: round((absolutePercentageErrors.filter((value) => value <= 10).length / rows.length) * 100),
    within15Pct: round((absolutePercentageErrors.filter((value) => value <= 15).length / rows.length) * 100),
    within25Pct: round((absolutePercentageErrors.filter((value) => value <= 25).length / rows.length) * 100),
  };
}

const raw = fs.readFileSync(inputPath, 'utf8');
const parsed = Papa.parse(raw, {
  header: true,
  skipEmptyLines: true,
});

if (parsed.errors.length) {
  throw new Error(`Could not parse ${inputPath}: ${parsed.errors[0].message}`);
}

const rows = parsed.data.map((row, index) => {
  const referenceUsd = Number(row.reference_usd);
  const dbUsd = Number(row.db_usd);
  if (!row.city || !row.anchor || !Number.isFinite(referenceUsd) || referenceUsd <= 0 || !Number.isFinite(dbUsd)) {
    throw new Error(`Invalid audit row ${index + 2}`);
  }

  const pctError = ((dbUsd - referenceUsd) / referenceUsd) * 100;
  const suppliedPctError = Number(row.pct_err);
  const suppliedApe = Number(row.ape);
  if (
    !Number.isFinite(suppliedPctError) ||
    !Number.isFinite(suppliedApe) ||
    Math.abs(pctError - suppliedPctError) > 1e-8 ||
    Math.abs(Math.abs(pctError) - suppliedApe) > 1e-8
  ) {
    throw new Error(`Precomputed error columns do not reconcile on row ${index + 2}`);
  }

  return {
    city: row.city,
    anchor: row.anchor,
    referenceUsd,
    dbUsd,
    pctError,
  };
});

const byCity = Object.fromEntries(
  [...groupBy(rows, 'city')].map(([city, cityRows]) => [city, summarize(cityRows)])
);
const byAnchor = Object.fromEntries(
  [...groupBy(rows, 'anchor')].map(([anchor, anchorRows]) => [anchor, summarize(anchorRows)])
);

const report = {
  input: path.relative(process.cwd(), inputPath).replaceAll('\\', '/'),
  generatedAt: new Date().toISOString(),
  coverage: {
    cities: new Set(rows.map((row) => row.city)).size,
    anchors: new Set(rows.map((row) => row.anchor)).size,
    comparisons: rows.length,
  },
  overall: summarize(rows),
  byCity,
  byAnchor,
  limitations: [
    'Descriptive spot check: only three cities are represented.',
    'Only food and drink anchors are represented; accommodation and activities are absent.',
    'Rows within a city are correlated and must not be treated as independent city samples.',
    'Reference observations have measurement error and are not literal ground truth.',
  ],
};

console.log(JSON.stringify(report, null, 2));
