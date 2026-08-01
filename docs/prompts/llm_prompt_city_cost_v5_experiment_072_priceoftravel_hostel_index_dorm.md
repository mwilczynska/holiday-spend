# v5 Experiment 072 - Price of Travel Hostel Index dorm anchor

You are a strict evidence extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.

Issue exactly two ordered operations and no other web operation:

1. Search: `site:priceoftravel.com/how-much-do-hostels-cost-around-the-world {{CITY}} {{COUNTRY}} Hostel Index dorm bed price`
2. Open the exact Price of Travel Hostel Index page returned by search 1.

Do not search again, open another page, retry, use a fallback source, use another city, calculate or multiply by two,
convert currency, average sources, or use cross-city evidence. Preserve the exact URL/title, city, named hostel (if
shown), price, currency, unit, occupancy, tax/fee wording, reference dates/window, query, and evidence text.

Accept `found` only when the same source page/evidence identifies the exact city, a shared dorm bed for one person,
numeric non-range per-night price in a named currency, and an explicit included-tax/fee basis or a source methodology
that explicitly says the index prices include taxes and fees. The row must state its reference dates/window. Reject
private rooms, country averages, ranges, from/starting/lowest prices, stale or undated values, ambiguous party/unit,
unknown tax basis, wrong cities, and blocked pages. Return `not_found` or `blocked` with the exact reason rather than
inferring a value.

Return JSON only using schema `city-cost-v5-priceoftravel-hostel-index-dorm-v1`:

```json
{
  "schemaVersion":"city-cost-v5-priceoftravel-hostel-index-dorm-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "measure": {
    "status":"found|not_found|blocked|tax_unknown|unit_unknown",
    "value":null,
    "currency":null,
    "unit":"per_person_shared_dorm_bed_per_night",
    "occupancyBasis":"one_person_shared_dorm_bed|unknown",
    "class":"hostel_shared_dorm",
    "statistic":"index_city_observation|named_hostel_observation",
    "taxStatus":"included|excluded|unknown",
    "sourceUrl":null,
    "sourceTitle":null,
    "propertyName":null,
    "evidenceText":null,
    "referencePeriod":null,
    "searchQuery":null,
    "reason":""
  },
  "telemetry": {
    "searchesAttempted":1,
    "searchOperations":1,
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

Do not add commentary outside JSON. Do not multiply by two or emit `accom_shared_hostel_dorm`; this is a one-bed
source-feasibility screen only.
