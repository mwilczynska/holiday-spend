import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/070-private-hostel-three-source-panel");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const isFinitePrice = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isCandidate = (candidate) => Boolean(candidate && candidate.status === "direct_candidate" &&
  candidate.propertyName && ["hostel", "private_hostel_room"].includes(candidate.propertyType) &&
  isFinitePrice(candidate.value) && candidate.currency && candidate.unit === "per_private_room_per_night" &&
  ["two_adults", "two_guests"].includes(candidate.occupancyBasis) &&
  candidate.class === "hostel_private_room" && candidate.statistic === "named_property_quote" &&
  ["included", "excluded"].includes(candidate.taxStatus) && candidate.priceType === "standard" &&
  candidate.sourceUrl && candidate.evidenceText);
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cities = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const row = JSON.parse(fs.readFileSync(file, "utf8"));
    const telemetry = row.telemetry ?? {};
    const candidates = Array.isArray(row.candidates) ? row.candidates : [];
    const accepted = candidates.filter(isCandidate);
    const protocolCompliant = row.schemaVersion === "city-cost-v5-private-hostel-three-source-panel-v1" &&
      telemetry.searchesAttempted === 3 && telemetry.searchOperations === 3 && telemetry.directReads === 0 &&
      telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 &&
      telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
    return { city, protocolCompliant, directCandidates: accepted.length, sources: accepted.map((item) => item.source), passed: accepted.length > 0 };
  } catch (error) {
    return { city, protocolCompliant: false, directCandidates: 0, sources: [], passed: false, error: String(error) };
  }
});
const result = {
  schemaVersion: "city-cost-v5-private-hostel-three-source-panel-audit-v1",
  citiesTested: cities.length,
  protocolCompliant: cities.filter((row) => row.protocolCompliant).length,
  citiesWithDirectCandidate: cities.filter((row) => row.passed).length,
  acceptedDirectCandidates: cities.reduce((sum, row) => sum + row.directCandidates, 0),
  screeningGate: "citiesWithDirectCandidate>=6 and protocolCompliant>=10",
  screeningGatePassed: cities.filter((row) => row.passed).length >= 6 && cities.filter((row) => row.protocolCompliant).length >= 10,
  finalValidationReminder: "A pass authorizes only a new property-basket design; at least 30 definition-compatible matched cities and 10 locked holdout cities remain required.",
  cities,
  productMapping: "none_private_hostel_screening_only"
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
