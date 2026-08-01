import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/079-hotevi-proxy-calibration");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const hoteviRows = [];
for (const [experiment, dirName, cities] of [["076","data/reference/v5/experiments/076-hotevi-grouped-tier-panel",inputs.developmentCitiesFrom076],["079",root,inputs.newCities.map((x)=>x.city)]]) {
  for (const city of cities) {
    const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const file = path.resolve(dirName, `${slug}.json`);
    if (!fs.existsSync(file)) continue;
    const p = JSON.parse(fs.readFileSync(file, "utf8"));
    const m = p.measures ?? {};
    const accepted = ["budget_1_2_star","mid_3_star","luxury_4_5_star"].every((key) => {
      const x = m[key];
      return x?.status === "found" && Number.isFinite(x.value) && x.value > 0 && x.currency === "USD" &&
        x.unit === "per_room_per_night" && x.occupancyBasis === "source_defined_standard_room" &&
        x.statistic === "monthly_average_price" && x.class === key && x.sourceUrl?.startsWith("http") &&
        x.referencePeriod && x.searchQuery && x.taxStatus === "unknown";
    });
    const t = p.telemetry ?? {};
    hoteviRows.push({ city, experiment, accepted, measures: m, protocolCompliant: t.searchesAttempted === 2 &&
      t.searchOperations === 1 && t.directReads === 1 && t.retries === 0 && t.fallbackSources === 0 &&
      t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false });
  }
}
const holdout = new Set(inputs.lockedHoldoutCities);
const rows = hoteviRows.filter((r) => r.accepted);
const matched = { threeStar: [], fourStar: [] };
const expediaRoots = ["028-expedia-class-trends","029-expedia-class-panel","059-expedia-class-panel","060-expedia-four-star-gap-panel","061-expedia-paired-panel","062-expedia-three-star-gap-panel","063-expedia-paired-panel-2","075-expedia-gap-panel","078-expedia-matched-panel"];
const expedia = new Map();
for (const dirName of expediaRoots) {
  const dir = path.resolve("data/reference/v5/experiments", dirName);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((x) => x.endsWith(".json") && !x.includes("telemetry") && !["inputs.json","results.json","audit.json"].includes(x))) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    if (!p.city) continue;
    const values = expedia.get(p.city) ?? {};
    for (const n of ["3","4"]) {
      const m = p.measures?.[`hotel_${n}star_room_2p`] ?? p.measures?.[`expedia_${n}_star`];
      const ok = m?.status === "found" && Number.isFinite(m.value) && m.value > 0 && /^[A-Z]{3}$/.test(m.currency ?? "") &&
        m.unit === "per_room_per_night" && m.class === `${n}_star` && m.sourceUrl?.startsWith("http") && m.referencePeriod &&
        m.searchQuery && (dirName === "028-expedia-class-trends" || dirName === "029-expedia-class-panel"
          ? m.occupancy === "two_adults" && /(?:excludes|excluding) taxes and fees/i.test(`${m.evidenceText ?? ""}`)
          : m.occupancyBasis === "explicit_two_adults_source_trend" && ["included","excluded"].includes(m.taxStatus));
      if (ok) values[n] = { value: m.value, currency: m.currency, source: dirName };
    }
    expedia.set(p.city, values);
  }
}
for (const row of rows) {
  const e = expedia.get(row.city) ?? {};
  if (e["3"] && row.measures.mid_3_star) matched.threeStar.push({ city: row.city, split: holdout.has(row.city) ? "holdout" : row.experiment === "076" ? "development" : "validation", proxy: row.measures.mid_3_star.value, target: e["3"].value, targetCurrency: e["3"].currency });
  if (e["4"] && row.measures.luxury_4_5_star) matched.fourStar.push({ city: row.city, split: holdout.has(row.city) ? "holdout" : row.experiment === "076" ? "development" : "validation", proxy: row.measures.luxury_4_5_star.value, target: e["4"].value, targetCurrency: e["4"].currency });
}
const protocol = hoteviRows.filter((r) => r.experiment === "079" && r.protocolCompliant).length;
const result = {
  schemaVersion: "city-cost-v5-hotevi-proxy-calibration-audit-v1",
  newCitiesTested: inputs.newCities.length,
  newCompleteProxyRows: hoteviRows.filter((r) => r.experiment === "079" && r.accepted).length,
  newProtocolCompliant: protocol,
  developmentProxyCities: hoteviRows.filter((r) => r.experiment === "076" && r.accepted).length,
  matchedCities: { threeStar: matched.threeStar.length, fourStar: matched.fourStar.length },
  matchedHoldoutCities: { threeStar: matched.threeStar.filter((r) => r.split === "holdout").length, fourStar: matched.fourStar.filter((r) => r.split === "holdout").length },
  calibrationGate: "each relationship >=30 matched cities and >=10 locked holdout cities and >=16 compliant new calls",
  calibrationGatePassed: matched.threeStar.length >= 30 && matched.fourStar.length >= 30 &&
    matched.threeStar.filter((r) => r.split === "holdout").length >= 10 && matched.fourStar.filter((r) => r.split === "holdout").length >= 10 && protocol >= 16,
  productMapping: "none_until_calibration_and_accuracy_fit",
  matched,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
