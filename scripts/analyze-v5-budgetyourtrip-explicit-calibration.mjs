import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/069-budgetyourtrip-explicit-calibration");
const inputPath = path.join(root, "inputs.json");
const inputs = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isProxy = (row) => {
  const p = row?.budgetyourtripProxy;
  return Boolean(p && typeof p === "object" && p.status === "proxy_candidate" &&
    isFiniteNumber(p.value) && p.currency && p.unit === "per_room_per_night" &&
    p.class === "1_star" && p.statistic === "city_class_average" &&
    ["included", "excluded", "before_taxes_and_fees"].includes(p.taxStatus) &&
    p.occupancyBasis === "source_defined_double_occupancy_snippet" &&
    p.sourceUrl && p.evidenceText);
};

const directStatus = new Set(["explicit_two_adult_candidate"]);
const isDirect = (candidate) => directStatus.has(candidate?.status) &&
  candidate.propertyName && isFiniteNumber(candidate.value) && candidate.currency &&
  candidate.unit === "per_room_per_night" &&
  candidate.occupancyBasis === "explicit_two_adults_one_room" &&
  candidate.class === "1_star" && candidate.statistic === "named_property_quote" &&
  ["included", "excluded"].includes(candidate.taxStatus) &&
  candidate.priceType === "standard" && candidate.sourceUrl && candidate.evidenceText;

const cityFiles = inputs.cities.map(({ city }) => ({
  city,
  file: path.join(root, `${city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`),
}));

const cities = [];
for (const { city, file } of cityFiles) {
  let row;
  try {
    row = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    cities.push({ city, protocolCompliant: false, proxyCandidate: false, directCandidates: 0, matched: false, error: String(error) });
    continue;
  }
  const telemetry = row.telemetry ?? {};
  const direct = Array.isArray(row.directCandidates) ? row.directCandidates : [];
  const acceptedDirect = direct.filter(isDirect);
  const protocolCompliant = row.schemaVersion === "city-cost-v5-budgetyourtrip-explicit-calibration-v1" &&
    telemetry.searchesAttempted === 5 && telemetry.searchOperations === 5 &&
    telemetry.directReads === 0 && telemetry.retries === 0 && telemetry.fallbackSources === 0 &&
    telemetry.arithmeticOperations === 0 && telemetry.currencyConversions === 0 &&
    telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
  const proxyCandidate = isProxy(row);
  cities.push({
    city,
    protocolCompliant,
    proxyCandidate,
    directCandidates: acceptedDirect.length,
    directSources: acceptedDirect.map((candidate) => candidate.source),
    matched: proxyCandidate && acceptedDirect.length > 0,
  });
}

const result = {
  schemaVersion: "city-cost-v5-budgetyourtrip-explicit-calibration-audit-v1",
  citiesTested: cities.length,
  protocolCompliant: cities.filter((city) => city.protocolCompliant).length,
  proxyCandidates: cities.filter((city) => city.proxyCandidate).length,
  explicitDirectCandidates: cities.reduce((sum, city) => sum + city.directCandidates, 0),
  matchedCities: cities.filter((city) => city.matched).length,
  screeningGate: "matchedCities>=6 and protocolCompliant>=10",
  screeningGatePassed: cities.filter((city) => city.matched).length >= 6 && cities.filter((city) => city.protocolCompliant).length >= 10,
  finalCalibrationReminder: "At least 30 definition-compatible matched cities including at least 10 locked holdout cities are required before fitting or product mapping.",
  cities,
  productMapping: "none_explicit_calibration_screen_only",
};

fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
