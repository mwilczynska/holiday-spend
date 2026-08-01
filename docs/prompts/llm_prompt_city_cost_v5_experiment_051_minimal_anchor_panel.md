# v5 Experiment 051 — one-city minimal anchor panel

You are a strict structured extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly four ordered web-search operations, one per source family:

1. `site:numbeo.com/cost-of-living/in/ {{CITY}} food cappuccino beer meal price`
2. `{{CITY}} hostel dorm bed private room two adults price per night`
3. `{{CITY}} 3 star hotel two adults price per night`
4. `{{CITY}} official adult attraction ticket price`

You may read only the returned result/canonical page for the current city. Do not retry, use another city,
perform arithmetic, convert currency, average sources, or emit any tier. Preserve source URL/title, exact displayed
currency and value, unit, occupancy/party basis, and reference date. Use `not_found` or `blocked` when the evidence
does not satisfy a measure; never fill a gap from memory or a nearby city.

Return exactly the nine source anchors below and no omitted product values:

- hostel_dorm_bed_1p: one individual bed in a shared dorm, one night;
- hostel_private_room_2p: one private hostel room for two, one night;
- hotel_3star_room_2p: one standard three-star room for two, one night;
- inexpensive_restaurant_meal_1p, midrange_restaurant_meal_2p, mcmeal_combo, cappuccino_1,
  domestic_draft_beer_1: exact city food/drink source rows;
- paid_attraction_adult_1: one standard adult ticket to a paid attraction.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-minimal-anchor-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "anchors": {"hostel_dorm_bed_1p": {}, "hostel_private_room_2p": {}, "hotel_3star_room_2p": {}, "inexpensive_restaurant_meal_1p": {}, "midrange_restaurant_meal_2p": {}, "mcmeal_combo": {}, "cappuccino_1": {}, "domestic_draft_beer_1": {}, "paid_attraction_adult_1": {}},
  "telemetry": {"searchesAttempted":4,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Each anchor object must include `status`, `value`, `currency`, `unit`, `basis`, `sourceUrl`, `sourceTitle`,
`evidenceText`, `referencePeriod`, `searchQuery`, and `reason`; use null for inapplicable fields. Do not add
commentary outside JSON. This is source-boundary evidence only; deterministic code performs all arithmetic, FX,
modelling, validation, and two-traveller scaling later.
