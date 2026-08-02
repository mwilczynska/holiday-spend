import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/092-drink-menu-calibration");
const sourceRoot = path.resolve("data/reference/v5/experiments/091-expatistan-drink-anchors");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const iso = (x) => /^[A-Z]{3}$/.test(x ?? "");
const samples = (x) => Array.isArray(x) && x.length >= 3 && x.every((v) => Number.isFinite(v) && v > 0);
const base = (x) => x?.status === "found" && iso(x.currency) && x.sourceUrl?.startsWith("http") && x.sourceTitle && x.evidenceText && x.referencePeriod && x.searchQuery && x.taxStatus;
const validCocktail = (x) => base(x) && x.unit === "per_person_item" && x.priceStatistic === "median_of_standard_classics" && samples(x.priceSamples);
const validWine = (x) => base(x) && x.unit === "per_person_item" && x.priceStatistic === "median_of_standard_red_glasses" && samples(x.priceSamples) && Number.isFinite(x.glassVolumeMl) && x.glassVolumeMl >= 125 && x.glassVolumeMl <= 175;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const source = new Map();
for (const { city } of inputs.cities) {
  const file = path.join(sourceRoot, `${slug(city)}.json`);
  if (!fs.existsSync(file)) continue;
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = p.measures?.cocktail;
  const w = p.measures?.wineBottle;
  source.set(city, { cocktail: c?.status === "found" && Number.isFinite(c.value) && iso(c.currency) ? c : null, wineBottle: w?.status === "found" && Number.isFinite(w.value) && iso(w.currency) ? w : null });
}
const protocol = [];
const rows = [];
for (const { city } of inputs.cities) {
  const file = path.join(root, `${slug(city)}.json`);
  if (!fs.existsSync(file)) { protocol.push({ city, protocolCompliant: false, reason: "missing artifact" }); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const t = p.telemetry ?? {};
  const compliant = p.schemaVersion === "city-cost-v5-drink-menu-calibration-v1" && t.searchesAttempted === 3 && t.searchOperations === 3 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false;
  protocol.push({ city, protocolCompliant: compliant });
  const c = validCocktail(p.cocktail) ? { city, measure: "cocktail", currency: p.cocktail.currency, median: median(p.cocktail.priceSamples), samples: p.cocktail.priceSamples, sourceUrl: p.cocktail.sourceUrl, taxStatus: p.cocktail.taxStatus } : null;
  const w = validWine(p.wineGlass) ? { city, measure: "wineGlass", currency: p.wineGlass.currency, median: median(p.wineGlass.priceSamples), samples: p.wineGlass.priceSamples, glassVolumeMl: p.wineGlass.glassVolumeMl, sourceUrl: p.wineGlass.sourceUrl, taxStatus: p.wineGlass.taxStatus } : null;
  if (c) rows.push(c);
  if (w) rows.push(w);
}
const ratios = rows.map((r) => { const s = source.get(r.city); const anchor = r.measure === "cocktail" ? s?.cocktail : s?.wineBottle; return anchor && anchor.currency === r.currency ? { city: r.city, measure: r.measure, sourceValue: anchor.value, groundTruthMedian: r.median, ratio: r.median / anchor.value } : null; }).filter(Boolean);
const byMeasure = (measure) => ratios.filter((r) => r.measure === measure);
const ratioSummary = (measure) => { const rs = byMeasure(measure); if (!rs.length) return { matchedRows: 0, medianRatio: null, ratios: [] }; return { matchedRows: rs.length, medianRatio: median(rs.map((r) => r.ratio)), ratios: rs }; };
const result = {
  schemaVersion: "city-cost-v5-drink-menu-calibration-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: protocol.filter((r) => r.protocolCompliant).length,
  strictRows: { cocktail: rows.filter((r) => r.measure === "cocktail").length, wineGlass: rows.filter((r) => r.measure === "wineGlass").length },
  screenGate: inputs.screenGate,
  screenGatePassed: protocol.filter((r) => r.protocolCompliant).length >= inputs.screenGate.protocolCompliant && rows.filter((r) => r.measure === "cocktail").length >= inputs.screenGate.cocktailRows && rows.filter((r) => r.measure === "wineGlass").length >= inputs.screenGate.wineGlassRows,
  sameCurrencyCalibrationScreen: { cocktail: ratioSummary("cocktail"), wineGlassAgainstBottle: ratioSummary("wineGlass") },
  productMapping: "none_until_locked_validation",
  protocol,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
