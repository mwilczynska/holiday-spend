import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/093-wine-volume-targeted-panel");
const sourceRoot = path.resolve("data/reference/v5/experiments/091-expatistan-drink-anchors");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const iso = (x) => /^[A-Z]{3}$/.test(x ?? "");
const strict = (x) => x?.status === "found" && iso(x.currency) && x.unit === "per_person_item" && x.priceStatistic === "median_of_standard_red_glasses" && Array.isArray(x.priceSamples) && x.priceSamples.length >= 3 && x.priceSamples.every((v) => Number.isFinite(v) && v > 0) && Number.isFinite(x.glassVolumeMl) && x.glassVolumeMl >= 125 && x.glassVolumeMl <= 175 && x.sourceUrl?.startsWith("http") && x.sourceTitle && x.evidenceText && x.referencePeriod && x.searchQuery && x.taxStatus;
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
const source = new Map();
for (const { city } of inputs.cities) {
  const file = path.join(sourceRoot, `${slug(city)}.json`);
  if (!fs.existsSync(file)) continue;
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const row = p.measures?.wineBottle;
  if (row?.status === "found" && Number.isFinite(row.value) && iso(row.currency)) source.set(city, row);
}
const protocol = [];
const rows = [];
for (const { city } of inputs.cities) {
  const file = path.join(root, `${slug(city)}.json`);
  if (!fs.existsSync(file)) { protocol.push({ city, protocolCompliant: false, reason: "missing artifact" }); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const t = p.telemetry ?? {};
  const compliant = p.schemaVersion === "city-cost-v5-wine-volume-targeted-v1" && t.searchesAttempted === 3 && t.searchOperations === 3 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false;
  protocol.push({ city, protocolCompliant: compliant });
  if (strict(p.wineGlass)) rows.push({ city, currency: p.wineGlass.currency, median: median(p.wineGlass.priceSamples), volumeMl: p.wineGlass.glassVolumeMl, sourceUrl: p.wineGlass.sourceUrl, taxStatus: p.wineGlass.taxStatus });
}
const ratios = rows.map((row) => { const anchor = source.get(row.city); return anchor && anchor.currency === row.currency ? { city: row.city, bottle: anchor.value, glass: row.median, ratio: row.median / anchor.value } : null; }).filter(Boolean);
const result = {
  schemaVersion: "city-cost-v5-wine-volume-targeted-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: protocol.filter((r) => r.protocolCompliant).length,
  strictRows: rows.length,
  screenGate: inputs.screenGate,
  screenGatePassed: protocol.filter((r) => r.protocolCompliant).length >= inputs.screenGate.protocolCompliant && rows.length >= inputs.screenGate.strictRows,
  sameCurrencyBottleRatios: { matchedRows: ratios.length, medianRatio: ratios.length ? median(ratios.map((r) => r.ratio)) : null, ratios },
  productMapping: "none_until_locked_validation",
  protocol,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
