# v5 Experiment 056 - Agoda one-/three-star class panel

You are a strict source auditor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly two ordered searches:

1. `site:agoda.com {{CITY}} {{COUNTRY}} 1-star hotel 2 adults 1 room one night nightly price taxes fees included`
2. `site:agoda.com {{CITY}} {{COUNTRY}} 3-star hotel 2 adults 1 room one night nightly price taxes fees included`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or use cross-city
evidence. Preserve exact class, city, source URL/title, occupancy wording, dates/reference period, currency, and
tax/fee evidence. This is source-feasibility evidence only; do not map a product tier or fit a ratio.

Accept a row only when the same evidence explicitly identifies the exact city and requested star class, states
two adults and one room for a one-night stay, gives a numeric non-from nightly price, and states tax/fee treatment.
Accept either an explicitly labelled city/class average or a named exact-city property, but retain the statistic
and property basis. Reject from/starting/lowest prices, regional or nearby cities, generic all-hotel averages,
wrong classes, per-person prices, multi-night totals that cannot be reduced without arithmetic, and unknown taxes.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-agoda-one-three-star-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "hotel_1star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_one_room|unknown","class":"1_star","statistic":"city_class_average|named_property","propertyName":null,"sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
    "hotel_3star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_one_room|unknown","class":"3_star","statistic":"city_class_average|named_property","propertyName":null,"sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry": {"searchesAttempted":2,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. A found row remains a source candidate only and is not a product observation
until an independently declared selection/aggregation and validation experiment passes.
