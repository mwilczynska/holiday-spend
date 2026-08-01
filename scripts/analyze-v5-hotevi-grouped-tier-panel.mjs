import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/076-hotevi-grouped-tier-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const groups = ["budget_1_2_star", "mid_3_star", "luxury_4_5_star"];
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const strict = (row, group) => Boolean(row?.status === "found" && finitePositive(row.value) && row.currency === "USD" &&
  row.unit === "per_room_per_night" && row.occupancyBasis === "source_defined_standard_room" && row.class === group &&
  row.statistic === "monthly_average_price" && ["included","excluded","unknown"].includes(row.taxStatus) &&
  row.sourceUrl === "https://hotevi.com/research" && row.sourceTitle && row.evidenceText && row.referencePeriod && row.searchQuery);
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rows = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    const telemetry = payload.telemetry ?? {};
    const protocolCompliant = payload.schemaVersion === "city-cost-v5-hotevi-grouped-tier-panel-v1" &&
      telemetry.searchesAttempted === 2 && telemetry.searchOperations === 1 && telemetry.directReads === 1 &&
      telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 &&
      telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
    const groupResults = Object.fromEntries(groups.map((group) => [group, strict(payload.measures?.[group], group)]));
    return { city, protocolCompliant, groups: groupResults, complete: Object.values(groupResults).every(Boolean),
      values: Object.fromEntries(groups.map((group) => [group, groupResults[group] ? payload.measures[group].value : null])),
      taxStatuses: Object.fromEntries(groups.map((group) => [group, groupResults[group] ? payload.measures[group].taxStatus : null])) };
  } catch (error) {
    return { city, protocolCompliant: false, groups: Object.fromEntries(groups.map((group) => [group, false])), complete: false,
      values: Object.fromEntries(groups.map((group) => [group, null])), taxStatuses: Object.fromEntries(groups.map((group) => [group, null])), error: String(error) };
  }
});
const result = {
  schemaVersion: "city-cost-v5-hotevi-grouped-tier-panel-audit-v1",
  citiesTested: rows.length,
  protocolCompliant: rows.filter((row) => row.protocolCompliant).length,
  strictByGroup: Object.fromEntries(groups.map((group) => [group, rows.filter((row) => row.groups[group]).length])),
  completeCities: rows.filter((row) => row.complete).length,
  screeningGate: "completeCities>=8 and protocolCompliant>=10",
  screeningGatePassed: rows.filter((row) => row.complete).length >= 8 && rows.filter((row) => row.protocolCompliant).length >= 10,
  productMapping: "none_source_defined_proxy_only",
  rows,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
