# v5 Experiment 062 - Expedia three-star gap panel

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly one Expedia-restricted search:

`site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotels average nightly price trend 2 adults taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source,
or use cross-city evidence. Preserve exact city/class, source URL/title, occupancy wording, price statistic,
reference window, currency, and tax/fee evidence. This is a coverage-repair experiment only; do not map a product
tier or fit a ratio.

Accept only an Expedia result that explicitly identifies the exact city and 3-star class, states a numeric non-from
average or trend for a nightly room for two adults, gives a named currency and reference window, and states tax/fee
treatment. An explicit statement that the trend is a base rate excluding taxes/fees is valid known basis and must be
recorded as `taxStatus: excluded`; never treat it as tax-inclusive. Reject district/nearby cities, generic all-hotel
trends, from/starting/lowest prices, single-property quotes, weekend/event-only values, ranges, per-person prices,
stale or malformed currencies, and class-ambiguous results.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-expedia-three-star-gap-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measure": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_source_trend|unknown","class":"3_star","statistic":"city_class_average","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry": {"searchesAttempted":1,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. A found row cannot amend Experiment 061's gate or authorize product mapping or
model fitting.
