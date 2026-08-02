import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/094-trip-class-proxy-calibration");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const iso = (x) => /^[A-Z]{3}$/.test(x ?? "");
const classes = ["2_star", "3_star", "4_star"];
const measureFor = (c) => `hotel_${c.replace("_star", "star")}_room_2p`;
const strictProxy = (row) => row?.status === "found" && Number.isFinite(row.value) && row.value > 0 && iso(row.currency) &&
  row.unit === "per_room_per_night" && row.basis === "source_defined_proxy" && row.statistic === "source_reported_weekday_average" &&
  row.occupancyBasis === "unknown" && row.taxStatus === "unknown" && row.sourceUrl?.startsWith("http") && row.sourceTitle &&
  row.evidenceText && row.referencePeriod && row.searchQuery;
const median = (values) => { const a = [...values].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const quantile = (values, q) => { const a = [...values].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)] : null; };

// The pooled Expedia audit is source evidence, not product ground truth. Prefer the newest panel
// for a city/class and require its explicit two-adult, tax-excluded contract.
const expDirs = ["063-expedia-paired-panel-2", "061-expedia-paired-panel", "060-expedia-four-star-gap-panel", "059-expedia-class-panel", "029-expedia-class-panel", "028-expedia-class-trends"];
const expAnchors = new Map();
for (const dir of expDirs) {
  const absolute = path.resolve("data/reference/v5/experiments", dir);
  if (!fs.existsSync(absolute)) continue;
  for (const file of fs.readdirSync(absolute).filter((x) => x.endsWith(".json") && !x.includes("telemetry") && !["results.json", "audit.json"].includes(x))) {
    const payload = JSON.parse(fs.readFileSync(path.join(absolute, file), "utf8"));
    for (const c of classes) {
      const row = payload.measures?.[measureFor(c)];
      const key = `${payload.city}::${c}`;
      if (!expAnchors.has(key) && row?.status === "found" && Number.isFinite(row.value) && iso(row.currency) && row.occupancyBasis === "explicit_two_adults_source_trend" && row.taxStatus === "excluded") {
        expAnchors.set(key, { city: payload.city, class: c, value: row.value, currency: row.currency, sourceExperiment: dir });
      }
    }
  }
}

const protocol = [];
const rows = [];
const byClass = Object.fromEntries(classes.map((c) => [c, 0]));
const cities = [];
for (const { city } of inputs.cities) {
  const file = path.join(root, `${slug(city)}.json`);
  if (!fs.existsSync(file)) { protocol.push({ city, protocolCompliant: false, reason: "missing artifact" }); continue; }
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const t = payload.telemetry ?? {};
  const compliant = payload.schemaVersion === "city-cost-v5-trip-class-proxy-v1" && t.searchesAttempted === 3 && t.searchOperations === 3 &&
    t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false;
  protocol.push({ city, protocolCompliant: compliant });
  const accepted = {};
  for (const c of classes) {
    const row = payload.classes?.[c];
    const ok = strictProxy(row);
    accepted[c] = ok;
    if (ok) { byClass[c] += 1; rows.push({ city, class: c, value: row.value, currency: row.currency, sourceUrl: row.sourceUrl, weekendValue: row.weekendValue ?? null }); }
  }
  cities.push({ city, accepted, complete: classes.every((c) => accepted[c]) });
}

const pairs = rows.map((row) => {
  const anchor = expAnchors.get(`${row.city}::${row.class}`);
  if (!anchor || anchor.currency !== row.currency) return null;
  const ratio = row.value / anchor.value;
  return { ...row, anchorValue: anchor.value, anchorCurrency: anchor.currency, anchorSourceExperiment: anchor.sourceExperiment, ratio, ape: Math.abs(ratio - 1), signedError: ratio - 1 };
}).filter(Boolean);
const protocolCount = protocol.filter((r) => r.protocolCompliant).length;
const gate = inputs.screenGate;
const result = {
  schemaVersion: "city-cost-v5-trip-class-proxy-calibration-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: protocolCount,
  proxyRows: rows.length,
  proxyRowsByClass: byClass,
  completeProxyCities: cities.filter((c) => c.complete).map((c) => c.city),
  sameCurrencyPairs: pairs.length,
  calibrationMetrics: { medianApe: median(pairs.map((r) => r.ape)), p90Ape: quantile(pairs.map((r) => r.ape), 0.9), medianSignedError: median(pairs.map((r) => r.signedError)), pairs },
  screenGate: gate,
  screenGatePassed: protocolCount >= gate.protocolCompliantCities && classes.every((c) => byClass[c] >= gate.proxyRowsPerClass) && pairs.length >= gate.sameCurrencyPairs &&
    (median(pairs.map((r) => r.ape)) ?? Infinity) <= gate.medianApe && (quantile(pairs.map((r) => r.ape), 0.9) ?? Infinity) <= gate.p90Ape,
  productMapping: "none_until_locked_validation",
  protocol,
  cities,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
