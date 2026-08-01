import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/071-activity-per-person-scaling-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const common = (row, unit, statistic) => row?.status === "found" && finitePositive(row.value) && row.currency && row.unit === unit &&
  ["included", "excluded"].includes(row.taxStatus) && row.statistic === statistic && row.sourceUrl && row.evidenceText;
const strict = {
  activities_budget: (row) => common(row, "per_person_ticket", "named_attraction_ticket") && row.partyBasis === "one_adult",
  activities_mid_range: (row) => common(row, "per_person_activity", "half_day_group_activity") &&
    ["one_adult", "per_person_group"].includes(row.partyBasis) && typeof row.durationHours === "number" && row.durationHours >= 3 && row.durationHours <= 6,
  activities_high_end: (row) => common(row, "per_person_activity", "full_day_premium_activity") &&
    ["one_adult", "per_person_group"].includes(row.partyBasis) && typeof row.durationHours === "number" && row.durationHours >= 6,
};
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cities = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const row = JSON.parse(fs.readFileSync(file, "utf8"));
    const telemetry = row.telemetry ?? {};
    const measures = row.measures ?? {};
    const protocolCompliant = row.schemaVersion === "city-cost-v5-activity-per-person-scaling-panel-v1" &&
      telemetry.searchesAttempted === 3 && telemetry.searchOperations === 3 && telemetry.directReads === 0 &&
      telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 &&
      telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
    const found = Object.fromEntries(Object.entries(strict).map(([key, check]) => [key, check(measures[key])]))
    return { city, protocolCompliant, found, complete: Object.values(found).every(Boolean) };
  } catch (error) {
    return { city, protocolCompliant: false, found: { activities_budget: false, activities_mid_range: false, activities_high_end: false }, complete: false, error: String(error) };
  }
});
const result = {
  schemaVersion: "city-cost-v5-activity-per-person-scaling-panel-audit-v1",
  citiesTested: cities.length,
  protocolCompliant: cities.filter((row) => row.protocolCompliant).length,
  strictCoverage: Object.fromEntries(Object.keys(strict).map((key) => [key, cities.filter((row) => row.found[key]).length])),
  completeCities: cities.filter((row) => row.complete).length,
  screeningGate: "each category>=8, completeCities>=6, protocolCompliant>=10",
  screeningGatePassed: Object.values(Object.fromEntries(Object.keys(strict).map((key) => [key, cities.filter((row) => row.found[key]).length]))).every((n) => n >= 8) &&
    cities.filter((row) => row.complete).length >= 6 && cities.filter((row) => row.protocolCompliant).length >= 10,
  deterministicScalingFactor: 2,
  productMapping: "none_activity_screening_only",
  cities,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
