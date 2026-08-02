# v5 Experiment 090 — one-call multi-source anchor bundle

You are a strict structured source extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly five ordered searches, one per source contract:

1. `site:numbeo.com/cost-of-living/in/ {{CITY}} {{COUNTRY}} inexpensive meal fast food cappuccino domestic beer imported beer cocktail wine`
2. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} entertainment budget mid-range luxury per person per day`
3. `site:expedia.com {{CITY}} {{COUNTRY}} 2-star 3-star 4-star hotel price trends 2 adults taxes fees`
4. `site:hostelworld.com {{CITY}} {{COUNTRY}} dorm bed private room one night price taxes`
5. `site:expedia.com {{CITY}} {{COUNTRY}} 1-star hotel average nightly price taxes fees`

Search only. Do not open pages, retry, use a fallback source, calculate, convert currency, average, derive tiers,
or use another city. Preserve every candidate's exact city, class, party/occupancy basis, statistic, currency,
tax status, reference period, source URL/title, and evidence text. A candidate that lacks a required field is
`not_found` for that measure. Do not infer two-adult occupancy from a query, infer USD from a bare `$`, or turn a
source-defined proxy into an observed product value.

Return JSON only:

```json
{
  "schemaVersion":"city-cost-v5-one-call-anchor-bundle-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "foodDrink": {
    "fast_food_meal": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_meal","basis":"street_fast_food|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "inexpensive_meal": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_meal","basis":"inexpensive_restaurant|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "midrange_meal": {"status":"found|not_found","value":null,"currency":null,"unit":"per_two_person_meal|per_person_meal","basis":"mid_range_restaurant|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "coffee": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_item","basis":"cappuccino|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "domestic_beer": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_item","basis":"domestic_draft_beer|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "cocktail": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_item","basis":"standard_cocktail|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "wine_glass": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_item","basis":"house_wine_glass|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "activities": {
    "budget": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_per_day","basis":"budget_entertainment|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "mid": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_per_day","basis":"mid_range_entertainment|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "high": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_per_day","basis":"luxury_entertainment|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "hotelClasses": {
    "twoStar": {"status":"found|not_found","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults|source_defined_double_occupancy|unknown","statistic":"city_class_average|unknown","taxStatus":"included|excluded|unknown","class":"2_star","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "threeStar": {"status":"found|not_found","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults|source_defined_double_occupancy|unknown","statistic":"city_class_average|unknown","taxStatus":"included|excluded|unknown","class":"3_star","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "fourStar": {"status":"found|not_found","value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults|source_defined_double_occupancy|unknown","statistic":"city_class_average|unknown","taxStatus":"included|excluded|unknown","class":"4_star","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "hostelAndOneStar": {
    "dorm": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_bed_night|unknown","occupancyBasis":"one_bed|unknown","basis":"shared_dorm|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "privateHostel": {"status":"found|not_found","value":null,"currency":null,"unit":"per_room_night|unknown","occupancyBasis":"explicit_two_adults|source_defined_double_occupancy|unknown","basis":"private_hostel_room|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "oneStar": {"status":"found|not_found","value":null,"currency":null,"unit":"per_room_per_night|unknown","occupancyBasis":"explicit_two_adults|source_defined_double_occupancy|unknown","basis":"one_star_class|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry":{"searchesAttempted":5,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0,"protocolCompliant":true}
}
```

Do not add commentary outside JSON.
