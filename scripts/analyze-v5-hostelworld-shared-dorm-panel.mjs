import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/074-hostelworld-shared-dorm-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const strict = (row) => Boolean(row?.status === "found" && finitePositive(row.value) && /^[A-Z]{3}$/.test(row.currency ?? "") &&
  row.unit === "per_person_shared_dorm_bed_per_night" && row.occupancyBasis === "one_person_shared_dorm_bed" &&
  row.class === "hostel_shared_dorm" && ["included", "excluded"].includes(row.taxStatus) && row.sourceUrl &&
  row.sourceUrl.includes("hostelworld") && row.sourceTitle && row.propertyName && row.evidenceText &&
  row.referencePeriod && row.searchQuery);
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rows = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    const telemetry = payload.telemetry ?? {};
    const protocolCompliant = payload.schemaVersion === "city-cost-v5-hostelworld-shared-dorm-panel-v1" &&
      telemetry.searchesAttempted === 1 && telemetry.searchOperations === 1 && telemetry.directReads === 0 &&
      telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 &&
      telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
    return { city, protocolCompliant, strict: strict(payload.measure), status: payload.measure?.status ?? "missing",
      value: strict(payload.measure) ? payload.measure.value : null,
      currency: strict(payload.measure) ? payload.measure.currency : null,
      propertyName: strict(payload.measure) ? payload.measure.propertyName : null,
      sourceUrl: strict(payload.measure) ? payload.measure.sourceUrl : null,
      reason: payload.measure?.reason ?? null };
  } catch (error) {
    return { city, protocolCompliant: false, strict: false, status: "missing", value: null, currency: null,
      propertyName: null, sourceUrl: null, reason: String(error) };
  }
});
const result = {
  schemaVersion: "city-cost-v5-hostelworld-shared-dorm-panel-audit-v1",
  citiesTested: rows.length,
  protocolCompliant: rows.filter((row) => row.protocolCompliant).length,
  strictRows: rows.filter((row) => row.strict).length,
  screeningGate: "strictRows>=8 and protocolCompliant>=10",
  screeningGatePassed: rows.filter((row) => row.strict).length >= 8 && rows.filter((row) => row.protocolCompliant).length >= 10,
  productMapping: "none_screening_only",
  rows,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
