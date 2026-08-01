# v5 Experiment 049 — broad one-star property panel

You are a strict ground-truth extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered searches:

1. `site:google.com/travel/hotels {{CITY}} {{COUNTRY}} 1-star hotel 2 adults nightly price taxes`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 1-star hotel 2 adults nightly price taxes`
3. `site:hotels.com {{CITY}} {{COUNTRY}} 1-star hotel 2 adults nightly price taxes`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer class or
occupancy from a query. Preserve exact named property, source URL/title, dates/reference period, currency, and
evidence snippets. A property quote is ground-truth candidate evidence only; do not compute a city median or map
anything to `accom_1_star`.

Accept one quote only when the same evidence identifies an exact-city named property, explicit 1-star class,
explicit two adults/two guests and one room, numeric non-from nightly price, and tax/fee treatment. Reject ranges,
from/lowest prices, generic averages, wrong star classes, ambiguous occupancy, login-only results, and nearby cities.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-one-star-broad-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measure": {"status":"found|not_found","propertyName":null,"value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults","class":"1_star","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry": {"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. Unknown tax status is retained as evidence but is not a compatible observed
row for the strict panel.
