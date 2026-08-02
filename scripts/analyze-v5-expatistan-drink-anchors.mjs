import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/091-expatistan-drink-anchors");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const finitePositive = (x) => Number.isFinite(x) && x > 0;
const iso = (x) => /^[A-Z]{3}$/.test(x ?? "");
const valid = (row, basis, unit) => row?.status === "found" && finitePositive(row.value) && iso(row.currency) && row.unit === unit && row.basis === basis && row.sourceUrl?.startsWith("http") && row.sourceTitle && row.evidenceText && row.referencePeriod && row.searchQuery && !/\b(?:comparison|nearby|regional|countrywide|from|starting)\b/i.test(`${row.sourceTitle} ${row.evidenceText}`);
const protocol = [];
const rows = [];
for (const { city } of inputs.cities) {
  const file = path.join(root, `${slug(city)}.json`);
  if (!fs.existsSync(file)) { protocol.push({ city, protocolCompliant: false, reason: "missing artifact" }); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const t = p.telemetry ?? {};
  const compliant = p.schemaVersion === "city-cost-v5-expatistan-drink-anchors-v1" && t.searchesAttempted === 2 && t.searchOperations === 2 && t.directReads === 0 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false;
  protocol.push({ city, protocolCompliant: compliant });
  for (const [key, basis, unit] of [["cocktail", "standard_cocktail_downtown_club", "per_person_item"], ["wineBottle", "red_table_wine_good_quality", "per_bottle"]]) {
    const row = p.measures?.[key];
    if (valid(row, basis, unit)) rows.push({ city, measure: key, value: row.value, currency: row.currency, taxStatus: row.taxStatus, sourceUrl: row.sourceUrl, referencePeriod: row.referencePeriod });
  }
}
const result = {
  schemaVersion: "city-cost-v5-expatistan-drink-anchors-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: protocol.filter((r) => r.protocolCompliant).length,
  acceptedRows: { cocktail: rows.filter((r) => r.measure === "cocktail").length, wineBottle: rows.filter((r) => r.measure === "wineBottle").length },
  screenGate: inputs.screenGate,
  screenGatePassed: protocol.filter((r) => r.protocolCompliant).length >= inputs.screenGate.protocolCompliant && rows.filter((r) => r.measure === "cocktail").length >= inputs.screenGate.cocktailRows && rows.filter((r) => r.measure === "wineBottle").length >= inputs.screenGate.wineBottleRows,
  bottleIsNotGlass: true,
  productMapping: "none_until_independent_calibration",
  protocol,
  rows,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
