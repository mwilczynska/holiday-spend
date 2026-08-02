import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/090-one-call-anchor-bundle");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const finitePositive = (x) => Number.isFinite(x) && x > 0;
const iso = (x) => /^[A-Z]{3}$/.test(x ?? "");
const baseValid = (x) => x?.status === "found" && finitePositive(x.value) && iso(x.currency) && x.sourceUrl?.startsWith("http") && x.sourceTitle && x.evidenceText && x.referencePeriod && x.searchQuery && x.taxStatus;
const validFood = (x) => baseValid(x) && x.unit && x.basis && x.basis !== "unknown";
const validActivity = (x) => baseValid(x) && x.unit === "per_person_per_day" && x.basis && x.basis !== "unknown";
const validHotel = (x, className) => baseValid(x) && x.unit === "per_room_per_night" && x.class === className && x.statistic === "city_class_average" && ["explicit_two_adults", "source_defined_double_occupancy", "unknown"].includes(x.occupancyBasis);
const validHostel = (x, kind) => baseValid(x) && x.basis === kind && x.occupancyBasis && x.occupancyBasis !== "unknown";
const foodKeys = ["fast_food_meal", "inexpensive_meal", "midrange_meal", "coffee", "domestic_beer", "cocktail", "wine_glass"];
const activityKeys = ["budget", "mid", "high"];
const hotelKeys = [["twoStar", "2_star"], ["threeStar", "3_star"], ["fourStar", "4_star"]];
const hostelKeys = [["dorm", "shared_dorm"], ["privateHostel", "private_hostel_room"], ["oneStar", "one_star_class"]];
const protocol = [];
const records = [];
for (const { city } of inputs.cities) {
  const file = path.join(root, `${slug(city)}.json`);
  if (!fs.existsSync(file)) { protocol.push({ city, protocolCompliant: false, reason: "missing artifact" }); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const t = p.telemetry ?? {};
  const protocolCompliant = p.schemaVersion === "city-cost-v5-one-call-anchor-bundle-v1" && t.searchesAttempted === 5 && t.searchOperations === 5 && t.directReads === 0 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false;
  const food = Object.fromEntries(foodKeys.map((key) => [key, validFood(p.foodDrink?.[key]) ? p.foodDrink[key] : null]));
  const activities = Object.fromEntries(activityKeys.map((key) => [key, validActivity(p.activities?.[key]) ? p.activities[key] : null]));
  const hotels = Object.fromEntries(hotelKeys.map(([key, cls]) => [key, validHotel(p.hotelClasses?.[key], cls) ? p.hotelClasses[key] : null]));
  const hostelAndOneStar = Object.fromEntries(hostelKeys.map(([key, basis]) => [key, validHostel(p.hostelAndOneStar?.[key], basis) ? p.hostelAndOneStar[key] : null]));
  protocol.push({ city, protocolCompliant });
  records.push({ city, food, activities, hotels, hostelAndOneStar });
}
const present = (group, keys) => keys.every((key) => Boolean(group[key]));
const count = (group, key) => group.filter((r) => Boolean(r[key])).length;
const summary = {
  foodDrink: Object.fromEntries(foodKeys.map((key) => [key, count(records.map((r) => r.food), key)])),
  activities: Object.fromEntries(activityKeys.map((key) => [key, count(records.map((r) => r.activities), key)])),
  hotelClasses: Object.fromEntries(hotelKeys.map(([key]) => [key, count(records.map((r) => r.hotels), key)])),
  hostelAndOneStar: Object.fromEntries(hostelKeys.map(([key]) => [key, count(records.map((r) => r.hostelAndOneStar), key)])),
};
const complete = {
  foodDrink: records.filter((r) => present(r.food, foodKeys)).map((r) => r.city),
  activities: records.filter((r) => present(r.activities, activityKeys)).map((r) => r.city),
  hotelClasses: records.filter((r) => present(r.hotels, hotelKeys.map(([key]) => key))).map((r) => r.city),
  hostelAndOneStar: records.filter((r) => present(r.hostelAndOneStar, hostelKeys.map(([key]) => key))).map((r) => r.city),
};
const allAnchorBundleCities = records.filter((r) => present(r.food, foodKeys) && present(r.activities, activityKeys) && present(r.hotels, hotelKeys.map(([key]) => key)) && present(r.hostelAndOneStar, hostelKeys.map(([key]) => key))).map((r) => r.city);
const result = {
  schemaVersion: "city-cost-v5-one-call-anchor-bundle-audit-v1",
  citiesTested: inputs.cities.length,
  protocolCompliant: protocol.filter((r) => r.protocolCompliant).length,
  gate: inputs.screenGate,
  protocolGatePassed: protocol.filter((r) => r.protocolCompliant).length >= inputs.screenGate.protocolCompliant,
  summary,
  complete,
  allAnchorBundleCities,
  evidenceBasis: "observed_or_source_defined_proxy_retained_separately",
  productMapping: "none_source_coverage_only",
  protocol,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
