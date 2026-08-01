# v5 Experiment 058 - Trip.com hotel-class tax panel

You are a strict source auditor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered searches:

1. `site:trip.com/hotels/star2/city {{CITY}} {{COUNTRY}} 2-star hotels 2 adults 1 room average nightly price taxes fees`
2. `site:trip.com/hotels/star3/city {{CITY}} {{COUNTRY}} 3-star hotels 2 adults 1 room average nightly price taxes fees`
3. `site:trip.com/hotels/star4/city {{CITY}} {{COUNTRY}} 4-star hotels 2 adults 1 room average nightly price taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source,
or use cross-city evidence. Preserve the exact city/class, source URL/title, occupancy wording, price statistic,
reference period, currency, and tax/fee evidence. This is source feasibility only; do not map a product tier or
fit a ratio.

Accept a row only when the same evidence explicitly identifies the exact city and requested class, states 2 adults
and 1 room, gives a numeric current city-class average nightly room price, and states whether taxes/fees are included
or excluded. Reject generic all-hotel averages, wrong/nearby cities, from/starting prices, event/weekend-only
values, per-person prices, stale or malformed currencies, and unknown tax treatment. Trip.com has no star-1 page;
do not treat that omission as evidence about star-1 availability.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-trip-class-tax-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "hotel_2star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_one_room|unknown","class":"2_star","statistic":"city_class_average","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
    "hotel_3star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_one_room|unknown","class":"3_star","statistic":"city_class_average","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
    "hotel_4star_room_2p": {"status":"found|not_found|class_absent","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults_one_room|unknown","class":"4_star","statistic":"city_class_average","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry": {"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. A found row remains a source candidate only and is not a product observation
until separate validation, source-basis compatibility, and aggregation decisions pass.
