# v5 Experiment 073 prompt — same-property dorm-index calibration

You are a bounded web-research extractor. You are given exactly one city. Do not use evidence from any other city.
Return one JSON object matching the schema below and no prose outside JSON.

Your job is to retrieve two source facts, not to estimate, calculate, average, convert currency, or derive a product
value.

1. Search for the exact Price of Travel Hostel Index row for the supplied city, then read the exact Price of Travel
   page returned by that search. Extract the named property and its one-person shared-dorm price, currency, tax/fee
   basis, and reference period. This is `indexObservation`.
2. Using the exact property name returned in step 1, perform one independent public search for a current nightly
   price for one person in a shared dorm bed at that same property and city. Prefer a signed-out public result from
   Hostelworld, Booking.com, Google Hotels, or another public booking source. Do not open a second page. This is
   `currentBenchmark`.

Use exactly three ordered web operations total: one index search, one exact index-page read, and one current-property
search. Do not retry, use fallback searches, read another page, use a second source, use another city, or ask a
follow-up question. If an operation is blocked, record that operation as blocked and fail closed.

Strict acceptance rules:

- `indexObservation` must be an exact city row with a named hostel, one-person shared-dorm bed, numeric per-night
  price, named currency, explicit tax/fee basis, and reference dates/window. Keep the source's original currency and
  2023 reference period.
- `currentBenchmark` must name the exact same property and city, be for one person in a shared dorm bed, be a numeric
  nightly price with named currency, and state a tax/fee basis. It must not be a from-price, sale-only price,
  multi-night total, private room, per-room amount, package, or occupancy-ambiguous result. Record the retrieval date.
- If any strict field is missing, set that measure's status to `not_found` and explain the precise missing field. Never
  infer occupancy, taxes, property identity, currency, or a price.
- Do not calculate the ratio, two-person price, FX conversion, uncertainty, or any other arithmetic. The local
  analyzer will score the two source facts.

Schema:

```json
{
  "schemaVersion":"city-cost-v5-priceoftravel-hostel-index-calibration-v1",
  "city":"...",
  "country":"...",
  "retrievalDate":"YYYY-MM-DD",
  "indexObservation": {
    "status":"found|not_found",
    "value": null,
    "currency": null,
    "unit":"per_person_shared_dorm_bed_per_night|null",
    "occupancyBasis":"one_person_shared_dorm_bed|null",
    "class":"hostel_shared_dorm|null",
    "statistic":"index_city_observation|named_hostel_observation|null",
    "taxStatus":"included|excluded|null",
    "sourceUrl":null,
    "sourceTitle":null,
    "propertyName":null,
    "evidenceText":null,
    "referencePeriod":null,
    "searchQuery":null,
    "reason":null
  },
  "currentBenchmark": {
    "status":"found|not_found",
    "value": null,
    "currency": null,
    "unit":"per_person_shared_dorm_bed_per_night|null",
    "occupancyBasis":"one_person_shared_dorm_bed|null",
    "class":"hostel_shared_dorm|null",
    "taxStatus":"included|excluded|null",
    "sourceUrl":null,
    "sourceTitle":null,
    "propertyName":null,
    "evidenceText":null,
    "referencePeriod":null,
    "searchQuery":null,
    "reason":null
  },
  "telemetry": {
    "searchesAttempted":3,
    "searchOperations":2,
    "directReads":1,
    "retries":0,
    "fallbackSources":0,
    "arithmeticOperations":0,
    "currencyConversions":0,
    "crossCityEvidence":0,
    "protocolCompliant":true
  }
}
```

The telemetry values must describe what actually happened. Set `protocolCompliant` to false if the operation count
or any restriction was violated. Never claim an operation did not happen.
