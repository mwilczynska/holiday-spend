import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/072-priceoftravel-hostel-index-dorm");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isStrict = (row) => row?.status === "found" && finitePositive(row.value) && row.currency &&
  row.unit === "per_person_shared_dorm_bed_per_night" && row.occupancyBasis === "one_person_shared_dorm_bed" &&
  row.class === "hostel_shared_dorm" && ["included", "excluded"].includes(row.taxStatus) && row.sourceUrl &&
  row.sourceTitle && row.evidenceText && row.referencePeriod && ["index_city_observation", "named_hostel_observation"].includes(row.statistic);
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cities = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const row = JSON.parse(fs.readFileSync(file, "utf8"));
    const telemetry = row.telemetry ?? {};
    const protocolCompliant = row.schemaVersion === "city-cost-v5-priceoftravel-hostel-index-dorm-v1" &&
      telemetry.searchesAttempted === 1 && telemetry.searchOperations === 1 && telemetry.directReads === 1 &&
      telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 &&
      telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
    return { city, protocolCompliant, strict: isStrict(row.measure), status: row.measure?.status ?? "missing" };
  } catch (error) {
    return { city, protocolCompliant: false, strict: false, status: "missing", error: String(error) };
  }
});
const result = {
  schemaVersion: "city-cost-v5-priceoftravel-hostel-index-dorm-audit-v1",
  citiesTested: cities.length,
  protocolCompliant: cities.filter((row) => row.protocolCompliant).length,
  strictRows: cities.filter((row) => row.strict).length,
  screeningGate: "strictRows>=8 and protocolCompliant>=10",
  screeningGatePassed: cities.filter((row) => row.strict).length >= 8 && cities.filter((row) => row.protocolCompliant).length >= 10,
  deterministicScalingFactor: 2,
  productMapping: "none_dorm_screening_only",
  cities,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
