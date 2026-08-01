# v5 Experiment 059 - Expedia two-adult class-trend panel

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered Expedia-restricted searches:

1. `site:expedia.com {{CITY}} {{COUNTRY}} 2-star hotels average nightly price trend 2 adults taxes fees`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotels average nightly price trend 2 adults taxes fees`
3. `site:expedia.com {{CITY}} {{COUNTRY}} 4-star hotels average nightly price trend 2 adults taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source,
or use cross-city evidence. Preserve the exact city/class, source URL/title, occupancy wording, price statistic,
reference window, currency, and tax/fee evidence. This is source feasibility only; do not map a product tier or fit
a ratio.

Accept a row only when the same Expedia evidence explicitly identifies the exact city and requested star class,
states a numeric average or trend for a nightly room for two adults, gives a named currency and reference window,
and states tax/fee treatment. An explicit statement that the displayed trend is a base rate excluding taxes/fees is
valid known basis and must be recorded as `taxStatus: excluded`; it must never be treated as tax-inclusive. Reject
from/starting/lowest prices, single-property quotes, weekend/event-only values, ranges, per-person prices, generic
city/country values, wrong or nearby cities, stale/malformed currencies, and class-ambiguous results. If a class is
not returned, use `not_found`, not `class_absent`, unless the source positively enumerates that the class is absent.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-expedia-class-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "hotel_2star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_source_trend|unknown","class":"2_star","statistic":"city_class_average","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "hotel_3star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_source_trend|unknown","class":"3_star","statistic":"city_class_average","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "hotel_4star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_source_trend|unknown","class":"4_star","statistic":"city_class_average","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry": {"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. A found row remains source-feasibility evidence only. It is not independent
ground truth, a product observation, or a fitted model input until source-basis compatibility and held-out accuracy
validation pass.
