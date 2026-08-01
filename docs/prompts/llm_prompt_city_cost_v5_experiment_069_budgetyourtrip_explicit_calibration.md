# v5 Experiment 069 - BudgetYourTrip one-star proxy explicit calibration screen

You are a strict evidence extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.

Issue exactly these five ordered searches and no other web operation:

1. `site:budgetyourtrip.com/hotels {{CITY}} {{COUNTRY}} 1-star hotel average price one night before taxes`
2. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} "two people" "double-occupancy" hotel price`
3. `{{CITY}} {{COUNTRY}} Google Hotels 1-star hotel two adults one room one night price taxes`
4. `site:expedia.com {{CITY}} {{COUNTRY}} 1-star hotel two adults one room nightly price taxes`
5. `site:hotels.com {{CITY}} {{COUNTRY}} 1-star hotel two adults one room nightly price taxes`

Search snippets only. Do not open pages, retry, issue another query, use another city, perform arithmetic or currency
conversion, average or select between sources, or use cross-city evidence. Preserve exact URLs/titles, source,
property name, city, star class, numeric value, currency, one-night unit, occupancy wording, tax/fee wording, price
type, reference period, and the exact evidence text. `from`, `starting`, `lowest`, sale/member/login-only, generic
city averages, and class-ambiguous properties are not direct candidates.

The first two searches are the BudgetYourTrip source-defined proxy pair. Accept `hotel_1star_proxy.status =
proxy_candidate` only when the first result gives an exact-city one-star numeric one-night USD value and explicit tax
basis, and the second result gives same-source exact-city two-person/double-occupancy wording. This is a proxy only.

For each of searches 3-5, accept a direct candidate only when the same evidence identifies an exact-city named property,
explicit one-star classification, numeric non-`from` nightly room price, two adults and one room (or equivalent), and
taxes/fees as included or excluded. Return `not_found`, `blocked`, `class_ambiguous`, `occupancy_unknown`,
`price_type_rejected`, or `tax_unknown` rather than inferring a missing fact. A direct named-property candidate is
not yet city-level ground truth and must not be combined with the proxy in this call.

Return JSON only using schema `city-cost-v5-budgetyourtrip-explicit-calibration-v1`:

```json
{
  "schemaVersion":"city-cost-v5-budgetyourtrip-explicit-calibration-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "budgetyourtripProxy": {
    "status":"proxy_candidate|not_found|blocked",
    "value":null,
    "currency":null,
    "unit":"per_room_per_night",
    "occupancyBasis":"source_defined_double_occupancy_snippet|unknown",
    "class":"1_star",
    "statistic":"city_class_average",
    "taxStatus":"included|excluded|before_taxes_and_fees|unknown",
    "sourceUrl":null,
    "sourceTitle":null,
    "evidenceText":null,
    "referencePeriod":null,
    "sampleSize":null,
    "reason":""
  },
  "directCandidates": [
    {
      "source":"google_hotels|expedia|hotels_com",
      "status":"explicit_two_adult_candidate|not_found|blocked|class_ambiguous|occupancy_unknown|price_type_rejected|tax_unknown",
      "propertyName":null,
      "value":null,
      "currency":null,
      "unit":"per_room_per_night",
      "occupancyBasis":"explicit_two_adults_one_room|unknown",
      "class":"1_star|unknown",
      "statistic":"named_property_quote",
      "taxStatus":"included|excluded|unknown",
      "priceType":"standard|from|lowest|member|sale|unknown",
      "sourceUrl":null,
      "sourceTitle":null,
      "evidenceText":null,
      "referencePeriod":null,
      "searchQuery":null,
      "reason":""
    }
  ],
  "telemetry": {
    "searchesAttempted":5,
    "searchOperations":0,
    "directReads":0,
    "retries":0,
    "fallbackSources":0,
    "arithmeticOperations":0,
    "currencyConversions":0,
    "crossCityEvidence":0,
    "protocolCompliant":true
  }
}
```

Do not add commentary outside JSON. No mapping, fitting, tax normalization, property-basket aggregation, or product
output is authorized by this experiment.
