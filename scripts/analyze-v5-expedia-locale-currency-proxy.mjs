import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/086-expedia-locale-currency-proxy");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const classes = ["2", "3", "4"];
const priorRoots = ["028-expedia-class-trends","029-expedia-class-panel","059-expedia-class-panel","060-expedia-four-star-gap-panel","061-expedia-paired-panel","063-expedia-paired-panel-2","075-expedia-gap-panel","078-expedia-matched-panel"];
const files = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes("telemetry") && !["inputs.json","results.json","audit.json"].includes(f)) : [];
const prior = new Map();
for (const dirName of priorRoots) {
  const dir = path.resolve("data/reference/v5/experiments", dirName);
  for (const file of files(dir)) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    for (const n of classes) {
      const m = payload.measures?.[`hotel_${n}star_room_2p`] ?? payload.measures?.[`expedia_${n}_star`];
      if (m?.status === "found" && Number.isFinite(m.value) && m.currency === "USD") prior.set(`${payload.city}\u0000${n}`, { value: m.value, city: payload.city, classNumber: n, currency: m.currency });
    }
  }
}
const strictShape = (m) => Number.isFinite(m?.value) && m.value > 0 && m.unit === "per_room_per_night" &&
  m.occupancyBasis === "explicit_two_adults_source_trend" && m.statistic === "city_class_average" &&
  m.sourceUrl?.startsWith("https://www.expedia.com/") && new URL(m.sourceUrl).hostname === "www.expedia.com" &&
  m.sourceTitle && m.evidenceText && m.referencePeriod && m.searchQuery && ["included","excluded"].includes(m.taxStatus) &&
  !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|event)\b/i.test(m.evidenceText);
const rows = [];
const perCity = [];
for (const {city} of inputs.cities) {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = path.join(root, `${slug}.json`);
  let payload;
  try { payload = JSON.parse(fs.readFileSync(file, "utf8")); } catch { perCity.push({ city, protocolCompliant: false }); continue; }
  const t = payload.telemetry ?? {};
  const compliant = payload.schemaVersion === "city-cost-v5-expedia-locale-currency-proxy-v1" && t.searchesAttempted === 3 && t.searchOperations === 3 && t.directReads === 0 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false;
  let accepted = 0;
  for (const n of classes) {
    const m = payload.measures?.[`hotel_${n}star_room_2p`];
    if (!strictShape(m)) continue;
    const hostGuard = m.currencyStatus === "bare_dollar" && m.currency === null && !/[?&](?:locale|lang|currency)=/i.test(m.sourceUrl);
    const named = m.status === "found_observed" && m.currency === "USD";
    if (!hostGuard && !named) continue;
    const mappedCurrency = named ? "USD" : "USD";
    const p = prior.get(`${city}\u0000${n}`);
    rows.push({ city, classNumber: n, value: m.value, originalStatus: m.status, currencyStatus: m.currencyStatus ?? "named", mappedCurrency,
      evidenceBasis: named ? "observed" : "source_locale_proxy", imputedMeasures: named ? [] : ["currency"],
      sourceUrl: m.sourceUrl, priorValue: p?.value ?? null, ape: p ? Math.abs(m.value - p.value) / p.value : null });
    accepted++;
  }
  perCity.push({ city, protocolCompliant: compliant, acceptedRows: accepted });
}
const matched = rows.filter((r) => Number.isFinite(r.ape));
const apes = matched.map((r) => r.ape).sort((a,b) => a-b);
const quantile = (p) => apes.length ? apes[Math.min(apes.length - 1, Math.floor(p * apes.length))] : null;
const median = quantile(0.5);
const result = {
  schemaVersion: "city-cost-v5-expedia-locale-currency-proxy-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: perCity.filter((r) => r.protocolCompliant).length,
  acceptedRows: rows.length,
  mappedProxyRows: rows.filter((r) => r.currencyStatus === "bare_dollar").length,
  namedRows: rows.filter((r) => r.currencyStatus !== "bare_dollar").length,
  sameCityClassMatches: matched.length,
  medianAPE: median,
  p90APE: quantile(0.9),
  screenGate: inputs.screenGate,
  screenGatePassed: perCity.filter((r) => r.protocolCompliant).length >= 10 && rows.length >= 10 && matched.length >= 10 && median !== null && median <= 0.25 && quantile(0.9) <= 0.50,
  mapping: "USD only under exact www.expedia.com host guard; evidence basis source_locale_proxy; no product mapping",
  rows,
  perCity,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
