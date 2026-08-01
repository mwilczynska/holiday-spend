import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/073-priceoftravel-hostel-index-calibration");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const strictIndex = (row) => Boolean(row?.status === "found" && finitePositive(row.value) && row.currency &&
  row.unit === "per_person_shared_dorm_bed_per_night" && row.occupancyBasis === "one_person_shared_dorm_bed" &&
  row.class === "hostel_shared_dorm" && ["included", "excluded"].includes(row.taxStatus) && row.sourceUrl &&
  row.sourceTitle && row.propertyName && row.evidenceText && row.referencePeriod &&
  ["index_city_observation", "named_hostel_observation"].includes(row.statistic));
const strictBenchmark = (row) => Boolean(row?.status === "found" && finitePositive(row.value) && row.currency &&
  row.unit === "per_person_shared_dorm_bed_per_night" && row.occupancyBasis === "one_person_shared_dorm_bed" &&
  row.class === "hostel_shared_dorm" && ["included", "excluded"].includes(row.taxStatus) && row.sourceUrl &&
  row.sourceTitle && row.propertyName && row.evidenceText && row.referencePeriod && row.searchQuery);
const sameProperty = (a, b) => typeof a === "string" && typeof b === "string" &&
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
const slug = (city) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const cities = inputs.cities.map(({ city }) => {
  const file = path.join(root, `${slug(city)}.json`);
  try {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const index = record.indexObservation;
    const benchmark = record.currentBenchmark;
    const telemetry = record.telemetry ?? {};
    const protocolCompliant = record.schemaVersion === "city-cost-v5-priceoftravel-hostel-index-calibration-v1" &&
      telemetry.searchesAttempted === 3 && telemetry.searchOperations === 2 && telemetry.directReads === 1 &&
      telemetry.retries === 0 && telemetry.fallbackSources === 0 && telemetry.arithmeticOperations === 0 &&
      telemetry.currencyConversions === 0 && telemetry.crossCityEvidence === 0 && telemetry.protocolCompliant === true;
    const indexStrict = strictIndex(index);
    const benchmarkStrict = strictBenchmark(benchmark);
    const pair = indexStrict && benchmarkStrict && sameProperty(index.propertyName, benchmark.propertyName) &&
      index.currency.toUpperCase() === benchmark.currency.toUpperCase();
    const ratio = pair ? benchmark.value / index.value : null;
    const signedError = pair ? (index.value - benchmark.value) / benchmark.value : null;
    return {
      city,
      protocolCompliant,
      indexStrict,
      benchmarkStrict,
      sameProperty: indexStrict && benchmarkStrict ? sameProperty(index.propertyName, benchmark.propertyName) : false,
      sameCurrency: indexStrict && benchmarkStrict ? index.currency.toUpperCase() === benchmark.currency.toUpperCase() : false,
      pair,
      ratio,
      absolutePercentageError: signedError === null ? null : Math.abs(signedError),
      signedPercentageError: signedError,
      indexValue: indexStrict ? index.value : null,
      indexCurrency: indexStrict ? index.currency : null,
      benchmarkValue: benchmarkStrict ? benchmark.value : null,
      benchmarkCurrency: benchmarkStrict ? benchmark.currency : null,
      indexProperty: indexStrict ? index.propertyName : null,
      benchmarkProperty: benchmarkStrict ? benchmark.propertyName : null,
      reason: record.reason ?? null,
    };
  } catch (error) {
    return { city, protocolCompliant: false, indexStrict: false, benchmarkStrict: false, sameProperty: false,
      sameCurrency: false, pair: false, ratio: null, absolutePercentageError: null, signedPercentageError: null,
      error: String(error) };
  }
});
const pairs = cities.filter((row) => row.pair);
const errors = pairs.map((row) => row.absolutePercentageError);
const result = {
  schemaVersion: "city-cost-v5-priceoftravel-hostel-index-calibration-audit-v1",
  citiesTested: cities.length,
  protocolCompliant: cities.filter((row) => row.protocolCompliant).length,
  strictIndexRows: cities.filter((row) => row.indexStrict).length,
  strictBenchmarkRows: cities.filter((row) => row.benchmarkStrict).length,
  strictSamePropertyPairs: cities.filter((row) => row.sameProperty).length,
  matchedPairs: pairs.length,
  screeningGate: "matchedPairs>=8 and protocolCompliant>=10",
  screeningGatePassed: pairs.length >= 8 && cities.filter((row) => row.protocolCompliant).length >= 10,
  metrics: {
    medianAbsolutePercentageError: percentile(errors, 0.5),
    p90AbsolutePercentageError: percentile(errors, 0.9),
    medianSignedPercentageError: percentile(pairs.map((row) => row.signedPercentageError), 0.5),
  },
  pairs,
  cities,
};
fs.writeFileSync(path.join(root, "results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
