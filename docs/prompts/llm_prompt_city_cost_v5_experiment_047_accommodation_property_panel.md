# v5 Experiment 047 — accommodation property panel

You are a strict ground-truth extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly four ordered searches:

1. `site:hostelworld.com {{CITY}} {{COUNTRY}} private room 2 guests price per night`
2. `site:booking.com {{CITY}} {{COUNTRY}} hostel private room 2 adults price per night`
3. `site:google.com/travel/hotels {{CITY}} {{COUNTRY}} 1-star hotel 2 adults price taxes`
4. `site:hotels.com {{CITY}} {{COUNTRY}} 1-star hotel 2 adults nightly price taxes`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer occupancy or
class from a query. Preserve exact property names, source URLs/titles, dates/reference period, currencies, and
evidence snippets. A property quote is ground-truth candidate evidence only; do not compute a city median or map
anything to a product value.

Accept `privateHostelQuote` only when one result identifies an exact-city named hostel/private room, explicitly
states two adults/two guests and one room, gives a numeric non-from one-night price, and states tax/fee treatment.
Accept `oneStarQuote` only when one result identifies an exact-city named property, explicit 1-star class, explicit
two adults/two guests and one room, numeric non-from nightly price, and tax/fee treatment. Reject ranges,
from/lowest prices, generic averages, wrong star classes, ambiguous occupancy, login-only results, and nearby cities.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-accommodation-property-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "privateHostelQuote": {"status":"found|not_found","propertyName":null,"value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults","class":"hostel_private_room","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "oneStarQuote": {"status":"found|not_found","propertyName":null,"value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults","class":"1_star","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry": {"searchesAttempted":4,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. Unknown tax status is retained as evidence but is not a compatible observed
row for the strict panel.
