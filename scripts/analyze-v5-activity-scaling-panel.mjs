import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/080-activity-scaling-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const holdout = new Set(inputs.lockedHoldoutCities);
const keys = ["activities_budget_per_person_day", "activities_mid_per_person_day", "activities_high_per_person_day"];
const rows = [];
for (const {city} of inputs.cities) {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = path.join(root, `${slug}.json`);
  if (!fs.existsSync(file)) { rows.push({city, complete:false, protocolCompliant:false, measures:{}}); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const m = p.measures ?? {};
  const strict = (x, tier) => x?.status === "found" && Number.isFinite(x.value) && x.value > 0 && x.currency === "USD" &&
    x.unit === "per_person_per_day" && x.partyBasis === "one_person" && x.tier === tier && x.scope === "entertainment_or_sightseeing" &&
    x.sourceUrl?.startsWith("http") && !/\/trip-itineraries\//i.test(x.sourceUrl) && x.sourceTitle && x.referencePeriod && x.searchQuery &&
    !/\b(?:from|starting|lowest|nearby|other city|per trip|per tour)\b/i.test(`${x.evidenceText ?? ""}`);
  const accepted = { budget: strict(m.activities_budget_per_person_day, "budget"), mid: strict(m.activities_mid_per_person_day, "mid_range"), high: strict(m.activities_high_per_person_day, "high_end") };
  const t = p.telemetry ?? {};
  rows.push({ city, complete: Object.values(accepted).every(Boolean), accepted, protocolCompliant: p.schemaVersion === "city-cost-v5-activity-scaling-panel-v1" &&
    t.searchesAttempted === 2 && t.searchOperations === 2 && t.directReads === 0 && t.retries === 0 && t.fallbackSources === 0 &&
    t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false,
    measures: m, scaled: Object.fromEntries(keys.map((key) => [key.replace("_per_person_day", ""), strict(m[key], key.includes("budget") ? "budget" : key.includes("mid") ? "mid_range" : "high_end") ? m[key].value * 2 : null])) });
}
const complete = rows.filter((r) => r.complete);
const protocol = rows.filter((r) => r.protocolCompliant);
const result = {
  schemaVersion: "city-cost-v5-activity-scaling-panel-audit-v1",
  citiesTested: rows.length,
  completeCities: complete.length,
  completeDevelopmentCities: complete.filter((r) => !holdout.has(r.city)).length,
  completeHoldoutCities: complete.filter((r) => holdout.has(r.city)).length,
  tierCoverage: Object.fromEntries(["budget","mid","high"].map((tier) => [tier, rows.filter((r) => r.accepted?.[tier]).length])),
  protocolCompliant: protocol.length,
  screenGate: "completeCities>=28 and protocolCompliant>=28",
  screenGatePassed: complete.length >= 28 && protocol.length >= 28,
  derivation: "activities_free=0; each accepted per-person/day tier is doubled exactly in deterministic code",
  productMapping: "none_until_definition_review_and_source_audit",
  rows: rows.map((r) => ({ city:r.city, complete:r.complete, protocolCompliant:r.protocolCompliant, accepted:r.accepted, scaled:r.scaled }))
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
