import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/077-hotevi-explicit-class-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const classes = ["1_star", "3_star", "4_star"];
const measures = {"1_star":"hotel_1star_room_2p", "3_star":"hotel_3star_room_2p", "4_star":"hotel_4star_room_2p"};
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const strict = (row, className) => Boolean(row?.status === "found" && finitePositive(row.value) && /^[A-Z]{3}$/.test(row.currency ?? "") &&
  row.unit === "per_room_per_night" && row.occupancyBasis === "explicit_two_adults" && row.class === className &&
  row.statistic === "named_property_quote" && ["included","excluded"].includes(row.taxStatus) &&
  row.sourceUrl?.startsWith("https://hotevi.com/hotel/") && row.sourceTitle && row.propertyName && row.evidenceText &&
  row.referencePeriod && row.searchQuery && !/\b(?:from|starting|lowest|sale|member|package|multi-night|per person)\b/i.test(row.evidenceText));
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rows = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    const t = payload.telemetry ?? {};
    const protocolCompliant = payload.schemaVersion === "city-cost-v5-hotevi-explicit-class-panel-v1" &&
      t.searchesAttempted === 6 && t.searchOperations === 3 && t.directReads === 3 && t.retries === 0 &&
      t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 &&
      t.protocolCompliant === true;
    const accepted = Object.fromEntries(classes.map((className) => [className, strict(payload.measures?.[measures[className]], className)]));
    return { city, protocolCompliant, accepted, complete: Object.values(accepted).every(Boolean), reasons: Object.fromEntries(classes.map((className) => [className, payload.measures?.[measures[className]]?.reason ?? null])) };
  } catch (error) {
    return { city, protocolCompliant: false, accepted: Object.fromEntries(classes.map((className) => [className, false])), complete: false, error: String(error) };
  }
});
const result = {
  schemaVersion: "city-cost-v5-hotevi-explicit-class-panel-audit-v1",
  citiesTested: rows.length,
  protocolCompliant: rows.filter((row) => row.protocolCompliant).length,
  strictByClass: Object.fromEntries(classes.map((className) => [className, rows.filter((row) => row.accepted[className]).length])),
  completeCities: rows.filter((row) => row.complete).length,
  screeningGate: "completeCities>=6 and every strictByClass>=8 and protocolCompliant>=10",
  screeningGatePassed: rows.filter((row) => row.complete).length >= 6 && classes.every((className) => rows.filter((row) => row.accepted[className]).length >= 8) && rows.filter((row) => row.protocolCompliant).length >= 10,
  productMapping: "none_source_screen_only",
  rows,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
