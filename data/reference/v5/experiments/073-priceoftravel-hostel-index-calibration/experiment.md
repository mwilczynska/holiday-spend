# Experiment 073 - Price of Travel dorm-index same-property calibration

## Hypothesis

The Price of Travel Hostel Index can remain a useful shared-dorm level anchor despite its April 2023 reference
window if its selected named-hostel observations are reasonably close to a current, independently retrieved quote
for the same property and the same one-person shared-dorm bed. This is a calibration screen only; it does not fit a
correction, convert currencies, or map a product field.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Bangkok, Lisbon, London, Paris, Rome, Prague, Tokyo, Hanoi, New York City, Sydney, Cape Town,
  and Mexico City.
- Exactly three ordered operations per call:
  1. search for the exact Price of Travel Hostel Index row for the city;
  2. read the exact Price of Travel page returned;
  3. search for the exact named hostel from that row and a current one-person shared-dorm bed nightly quote.
- The third operation may use a public signed-out result from Hostelworld, Booking.com, Google Hotels, or another
  public booking source exposed by the search, but it must remain one search operation and must not be opened.
- No second search/read, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- `indexObservation` must satisfy the strict Experiment 072 contract and retain its stated April 2023 reference
  window, named property, currency, and tax basis.
- `currentBenchmark` is accepted only when it names the same city and exact same property, states a shared dorm bed
  for one person, gives a numeric nightly price and currency, and states a tax/fee basis and retrieval date. A
  `from`, sale, package, multi-night total, private room, per-room amount, ambiguous property, or occupancy-unknown
  result fails closed.
- Luna reports source facts only. Deterministic code computes the paired ratio and error; Luna must not calculate.
- Currency conversion is forbidden. A pair is scored only when both values have the same currency.

## Pre-registered screening gate

- At least 8/12 cities have a strict same-property pair with matching currency.
- At least 10/12 calls are protocol-compliant.
- This screen does not authorize a correction factor or product mapping. A pass authorizes a new, larger calibration
  design with at least 30 matched cities and at least 10 locked city-level holdouts; a fail rejects this source/model
  boundary at the current retrieval shape.

## Scoring plan

For each strict, same-currency pair, deterministic code reports:

- `current/index` ratio;
- absolute percentage error relative to the current benchmark;
- signed percentage error relative to the current benchmark;
- median and p90 paired error, with bootstrap intervals when sample size permits.

No global correction is fitted in this experiment. The paired benchmark is not treated as a production ground truth
until its definition and retrieval basis are independently audited.

## Results

The twelve one-city contexts were protocol-compliant (12/12) and all twelve recovered a strict Price of Travel
index row. Only five current benchmark rows were strict, four had the same property identity, and only one pair
(Lisbon) had matching currency. The strict same-currency pair had an index value of USD 17.76 and a current benchmark
of USD 29, an absolute percentage error of 38.76% and a signed error of -38.76% relative to the current benchmark.

The other strict current rows were returned in CNY while the index is in USD; they remain unscored under the
pre-registered no-FX calibration screen. London, Rome, Prague, Tokyo, New York City, Sydney, and Cape Town failed the
strict current benchmark contract. Paris had a near-identical but not exact property spelling and a CNY quote, so it
was not silently joined.

The deterministic audit is in `results.json` and the raw per-city records and telemetry sidecars are retained here.

**Verdict:** reject this same-currency calibration screen. It produced 1/12 matched pairs, below the 8/12 gate,
despite 12/12 protocol compliance. Do not map or fit the Price of Travel index. A follow-up may test a pre-registered
deterministic FX normalization of definition-compatible pairs, but it must retain explicit property identity, tax
basis, retrieval date, and a 30-city/10-holdout accuracy requirement.
