import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/089-activity-semantic-calibration");
const baselineRoot = path.resolve("data/reference/v5/experiments/080-activity-scaling-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const files = fs.readdirSync(root).filter((file) => file.endsWith(".json") && !["inputs.json", "results.json", "audit.json"].includes(file));
const measures = [
  ["paid_attraction_adult_1", "budget", "per_person_ticket", "standard_adult_ticket"],
  ["half_day_group_activity_adult_1", "mid", "per_person_activity", "half_day_group"],
  ["full_day_premium_activity_adult_1", "high", "per_person_activity", "full_day_premium"],
];
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const finitePositive = (value) => Number.isFinite(value) && value > 0;
const isoCurrency = (value) => /^[A-Z]{3}$/.test(value ?? "");
const noBadEvidence = (row) => !/\b(?:from|starting|lowest|nearby|regional|multi-city|child|resident|countrywide)\b/i.test(`${row.evidenceText ?? ""} ${row.sourceTitle ?? ""}`);
const valid = (row, measure, expectedUnit, expectedBasis) => {
  if (!row || row.status !== "found" || !finitePositive(row.value) || !isoCurrency(row.currency)) return false;
  if (row.unit !== expectedUnit || row.activityBasis !== expectedBasis || row.partyBasis === "unknown") return false;
  if (!row.sourceUrl?.startsWith("http") || !row.sourceTitle || !row.evidenceText || !row.referencePeriod || !row.searchQuery) return false;
  if (!['included', 'excluded'].includes(row.taxStatus) || !noBadEvidence(row)) return false;
  if (measure === "half_day_group_activity_adult_1" && (!Number.isFinite(row.durationHours) || row.durationHours < 3 || row.durationHours > 6)) return false;
  if (measure === "full_day_premium_activity_adult_1" && (!Number.isFinite(row.durationHours) || row.durationHours < 6 || !row.premiumBasis)) return false;
  return true;
};

const baseline = new Map();
for (const { city } of inputs.cities) {
  const file = path.join(baselineRoot, `${slug(city)}.json`);
  if (!fs.existsSync(file)) continue;
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const values = {
    budget: payload.measures?.activities_budget_per_person_day,
    mid: payload.measures?.activities_mid_per_person_day,
    high: payload.measures?.activities_high_per_person_day,
  };
  if (Object.values(values).every((row) => finitePositive(row?.value) && row.currency === "USD")) baseline.set(city, values);
}

const rows = [];
const protocol = [];
for (const { city } of inputs.cities) {
  const file = path.join(root, `${slug(city)}.json`);
  if (!fs.existsSync(file)) {
    protocol.push({ city, protocolCompliant: false, reason: "missing artifact" });
    continue;
  }
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const telemetry = payload.telemetry ?? {};
  const compliant = payload.schemaVersion === "city-cost-v5-activity-semantic-calibration-v1" && telemetry.searchesAttempted === 3 && telemetry.searchOperations === 3 && telemetry.directReads === 0 && telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 && telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant !== false;
  protocol.push({ city, protocolCompliant: compliant });
  for (const [measure, tier, unit, basis] of measures) {
    const row = payload.measures?.[measure];
    if (valid(row, measure, unit, basis)) rows.push({ city, measure, tier, value: row.value, currency: row.currency, taxStatus: row.taxStatus, sourceUrl: row.sourceUrl, durationHours: row.durationHours ?? null });
  }
}

const strictByTier = Object.fromEntries(measures.map(([, tier]) => [tier, rows.filter((row) => row.tier === tier)]));
const completeCities = inputs.cities.map((x) => x.city).filter((city) => measures.every(([, tier]) => strictByTier[tier].some((row) => row.city === city)));
const matched = rows.filter((row) => row.currency === "USD" && baseline.has(row.city));
const matchedByTier = Object.fromEntries(measures.map(([, tier]) => [tier, matched.filter((row) => row.tier === tier)]));
const ratios = {};
const calibration = {};
for (const [, tier] of measures) {
  const values = matchedByTier[tier].map((row) => ({ ...row, ratio: row.value / baseline.get(row.city)[tier].value }));
  ratios[tier] = values;
  const median = values.length ? [...values].sort((a, b) => a.ratio - b.ratio)[Math.floor(values.length / 2)].ratio : null;
  const absolutePercentageErrors = values.filter((row) => median != null).map((row) => Math.abs((median * baseline.get(row.city)[tier].value - row.value) / row.value));
  const holdout = values.filter((row) => inputs.lockedHoldoutCities.includes(row.city));
  const dev = values.filter((row) => !inputs.lockedHoldoutCities.includes(row.city));
  const devMedian = dev.length ? [...dev].sort((a, b) => a.ratio - b.ratio)[Math.floor(dev.length / 2)].ratio : null;
  const holdoutApe = holdout.filter(() => devMedian != null).map((row) => Math.abs((devMedian * baseline.get(row.city)[tier].value - row.value) / row.value));
  calibration[tier] = { matchedRows: values.length, medianRatio: median, medianApe: absolutePercentageErrors.length ? absolutePercentageErrors.sort((a, b) => a - b)[Math.floor(absolutePercentageErrors.length / 2)] : null, developmentRows: dev.length, holdoutRows: holdout.length, holdoutMedianApe: holdoutApe.length ? holdoutApe.sort((a, b) => a - b)[Math.floor(holdoutApe.length / 2)] : null };
}

const result = {
  schemaVersion: "city-cost-v5-activity-semantic-calibration-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: protocol.filter((row) => row.protocolCompliant).length,
  strictRows: Object.fromEntries(measures.map(([, tier]) => [tier, strictByTier[tier].length])),
  strictCompleteCities: completeCities,
  compatibleUsdRows: Object.fromEntries(measures.map(([, tier]) => [tier, matchedByTier[tier].length])),
  gate: inputs.screenGate,
  screenGatePassed: protocol.filter((row) => row.protocolCompliant).length >= inputs.screenGate.protocolCompliant && measures.every(([, tier]) => strictByTier[tier].length >= inputs.screenGate.strictRowsPerAnchor) && completeCities.length >= inputs.screenGate.completeCities,
  calibration,
  productMapping: "none_until_independent_definition_validation",
  protocol,
  acceptedRows: rows,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
