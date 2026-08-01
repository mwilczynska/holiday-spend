import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/085-expedia-query-contract");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const classNumbers = ["2", "3", "4"];
const priorRoots = [
  ["028", "data/reference/v5/experiments/028-expedia-class-trends"],
  ["029", "data/reference/v5/experiments/029-expedia-class-panel"],
  ["059", "data/reference/v5/experiments/059-expedia-class-panel"],
  ["060", "data/reference/v5/experiments/060-expedia-four-star-gap-panel"],
  ["061", "data/reference/v5/experiments/061-expedia-paired-panel"],
  ["063", "data/reference/v5/experiments/063-expedia-paired-panel-2"],
  ["075", "data/reference/v5/experiments/075-expedia-gap-panel"],
  ["078", "data/reference/v5/experiments/078-expedia-matched-panel"],
];
const preference = {"028":1,"029":2,"059":3,"060":4,"061":5,"063":6,"075":7,"078":8,"085":9};
const filesIn = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir).filter((name) =>
  name.endsWith(".json") && !name.endsWith("-telemetry.json") && !["inputs.json","results.json","audit.json"].includes(name));
const legacyAccepted = (measure, classNumber) => measure?.status === "found" && Number.isFinite(measure.value) && measure.value > 0 &&
  /^[A-Z]{3}$/.test(measure.currency ?? "") && measure.unit === "per_room_per_night" && measure.class === `${classNumber}_star` &&
  measure.occupancy === "two_adults" && measure.sourceUrl?.startsWith("http") &&
  /(?:excludes|excluding) taxes and fees/i.test(`${measure.evidenceText ?? ""}`) && measure.referencePeriod && measure.searchQuery;
const strict = (measure, classNumber) => measure?.status === "found" && Number.isFinite(measure.value) && measure.value > 0 &&
  /^[A-Z]{3}$/.test(measure.currency ?? "") && measure.unit === "per_room_per_night" && measure.class === `${classNumber}_star` &&
  measure.occupancyBasis === "explicit_two_adults_source_trend" && measure.statistic === "city_class_average" &&
  measure.sourceUrl?.startsWith("http") && measure.sourceTitle && measure.evidenceText && measure.referencePeriod &&
  measure.searchQuery && ["included","excluded"].includes(measure.taxStatus) &&
  !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|this weekend|event)\b/i.test(measure.evidenceText);
const rows = [];
for (const [experiment, relative] of [...priorRoots, ["085", "data/reference/v5/experiments/085-expedia-query-contract"]]) {
  const dir = path.resolve(relative);
  for (const file of filesIn(dir)) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    for (const classNumber of classNumbers) {
      const measure = payload.measures?.[`hotel_${classNumber}star_room_2p`] ?? payload.measures?.[`expedia_${classNumber}_star`] ?? {};
      const accepted = experiment === "028" || experiment === "029" ? legacyAccepted(measure, classNumber) : strict(measure, classNumber);
      if (!accepted) continue;
      rows.push({ experiment, city: payload.city, classNumber, value: measure.value, currency: measure.currency,
        taxStatus: measure.taxStatus, sourceUrl: measure.sourceUrl, sourceTitle: measure.sourceTitle,
        retrievalDate: payload.retrievalDate });
    }
  }
}
const chosen = new Map();
for (const row of rows) {
  const key = `${row.city}\u0000${row.classNumber}`;
  if (!chosen.has(key) || preference[row.experiment] > preference[chosen.get(key).experiment]) chosen.set(key, row);
}
const pooled = [...chosen.values()];
const cities = [...new Set(pooled.map((row) => row.city))].sort();
const pairs = {
  hotel_2_from_3: cities.filter((city) => ["2","3"].every((n) => pooled.some((row) => row.city === city && row.classNumber === n))),
  hotel_4_from_3: cities.filter((city) => ["3","4"].every((n) => pooled.some((row) => row.city === city && row.classNumber === n))),
};
const protocol = inputs.cities.map(({ city }) => {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = path.join(root, `${slug}.json`);
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    const t = payload.telemetry ?? {};
    return { city, protocolCompliant: payload.schemaVersion === "city-cost-v5-expedia-query-contract-v1" &&
      t.searchesAttempted === 3 && t.searchOperations === 3 && t.directReads === 0 && t.retries === 0 &&
      t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 &&
      t.crossCityEvidence === 0 && t.protocolCompliant !== false };
  } catch { return { city, protocolCompliant: false }; }
});
const newRows = pooled.filter((row) => row.experiment === "085");
const result = {
  schemaVersion: "city-cost-v5-expedia-query-contract-audit-v1",
  newCitiesTested: inputs.cities.length,
  newRows: newRows.length,
  newCities: inputs.cities.map(({city}) => ({ city, strictRows: newRows.filter((r) => r.city === city).length,
    classes: newRows.filter((r) => r.city === city).map((r) => r.classNumber).sort() })),
  protocolCompliant: protocol.filter((row) => row.protocolCompliant).length,
  pooledRows: pooled.length,
  pooledCities: cities.length,
  pooledMatchedCities: { hotel_2_from_3: pairs.hotel_2_from_3.length, hotel_4_from_3: pairs.hotel_4_from_3.length },
  pooledGate: "hotel_2_from_3>=30 and hotel_4_from_3>=30 and protocolCompliant>=10",
  pooledGatePassed: pairs.hotel_2_from_3.length >= 30 && pairs.hotel_4_from_3.length >= 30 && protocol.filter((row) => row.protocolCompliant).length >= 10,
  productMapping: "none_pooled_ceiling_only",
  protocol,
  pairs,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
