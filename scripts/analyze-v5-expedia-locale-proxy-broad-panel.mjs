import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/087-expedia-locale-proxy-broad-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const classes = ["2", "3", "4"];
const priorRoots = [
  ["028", "data/reference/v5/experiments/028-expedia-class-trends"], ["029", "data/reference/v5/experiments/029-expedia-class-panel"],
  ["059", "data/reference/v5/experiments/059-expedia-class-panel"], ["060", "data/reference/v5/experiments/060-expedia-four-star-gap-panel"],
  ["061", "data/reference/v5/experiments/061-expedia-paired-panel"], ["063", "data/reference/v5/experiments/063-expedia-paired-panel-2"],
  ["075", "data/reference/v5/experiments/075-expedia-gap-panel"], ["078", "data/reference/v5/experiments/078-expedia-matched-panel"],
  ["086", "data/reference/v5/experiments/086-expedia-locale-currency-proxy"],
];
const preference = {"028":1,"029":2,"059":3,"060":4,"061":5,"063":6,"075":7,"078":8,"086":9,"087":10};
const filesIn = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes("telemetry") && !["inputs.json","results.json","audit.json"].includes(f)) : [];
const accepted = (m, n, allowProxy) => {
  const host = (() => { try { return new URL(m?.sourceUrl ?? "").hostname; } catch { return ""; } })();
  const currency = m?.currency === "USD" || (allowProxy && m?.currency === null && m?.currencyStatus === "bare_dollar");
  return Number.isFinite(m?.value) && m.value > 0 && m.unit === "per_room_per_night" && m.occupancyBasis === "explicit_two_adults_source_trend" && m.class === `${n}_star` && m.statistic === "city_class_average" && host === "www.expedia.com" && m.sourceTitle && m.evidenceText && m.referencePeriod && m.searchQuery && ["included","excluded"].includes(m.taxStatus) && currency && !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|event)\b/i.test(m.evidenceText);
};
const rows = [];
for (const [experiment, relative] of [...priorRoots, ["087", "data/reference/v5/experiments/087-expedia-locale-proxy-broad-panel"]]) {
  const dir = path.resolve(relative);
  for (const file of filesIn(dir)) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    for (const n of classes) {
      const m = p.measures?.[`hotel_${n}star_room_2p`] ?? p.measures?.[`expedia_${n}_star`];
      if (!accepted(m, n, experiment === "086" || experiment === "087")) continue;
      rows.push({ experiment, city: p.city, classNumber: n, value: m.value, currency: m.currency ?? "USD", evidenceBasis: m.currencyStatus === "bare_dollar" ? "source_locale_proxy" : "observed", imputedMeasures: m.currencyStatus === "bare_dollar" ? ["currency"] : [], sourceUrl: m.sourceUrl, retrievalDate: p.retrievalDate });
    }
  }
}
const chosen = new Map();
for (const row of rows) { const key = `${row.city}\u0000${row.classNumber}`; if (!chosen.has(key) || preference[row.experiment] > preference[chosen.get(key).experiment]) chosen.set(key, row); }
const pooled = [...chosen.values()];
const cities = [...new Set(pooled.map((r) => r.city))].sort();
const pairs = { hotel_2_from_3: cities.filter((c) => ["2","3"].every((n) => pooled.some((r) => r.city === c && r.classNumber === n))), hotel_4_from_3: cities.filter((c) => ["3","4"].every((n) => pooled.some((r) => r.city === c && r.classNumber === n))) };
const protocol = inputs.cities.map(({city}) => { const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); try { const p = JSON.parse(fs.readFileSync(path.join(root, `${slug}.json`), "utf8")); const t = p.telemetry ?? {}; return {city, protocolCompliant: p.schemaVersion === "city-cost-v5-expedia-locale-proxy-broad-v1" && t.searchesAttempted === 3 && t.searchOperations === 3 && t.directReads === 0 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false}; } catch { return {city, protocolCompliant:false}; }});
const newRows = pooled.filter((r) => r.experiment === "087");
const result = { schemaVersion: "city-cost-v5-expedia-locale-proxy-broad-audit-v1", newCitiesTested: inputs.cities.length, newRows: newRows.length, protocolCompliant: protocol.filter((r) => r.protocolCompliant).length, pooledRows: pooled.length, pooledCities: cities.length, pooledMatchedCities: {hotel_2_from_3:pairs.hotel_2_from_3.length, hotel_4_from_3:pairs.hotel_4_from_3.length}, gate: inputs.gate, gatePassed: inputs.cities.length >= inputs.gate.newCalls && protocol.filter((r) => r.protocolCompliant).length >= inputs.gate.protocolCompliant && pairs.hotel_2_from_3.length >= inputs.gate.matched2From3 && pairs.hotel_4_from_3.length >= inputs.gate.matched4From3, mapping: "USD only under exact www.expedia.com host guard; proxy evidence remains labelled and no fitting occurs", protocol, pairs };
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
