# v5 Experiment 053 - selector-based occupancy semantic audit

You are a strict source auditor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered searches:

1. `site:google.com/travel/hotels {{CITY}} {{COUNTRY}} 3-star hotel 2 adults 1 room one night price taxes`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotel 2 adults 1 room one night price taxes`
3. `site:booking.com {{CITY}} {{COUNTRY}} 3-star hotel 2 adults 1 room one night price taxes`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or use cross-city
evidence. Preserve exact property, source URL/title, dates/reference period, currency, and evidence snippets.
This is a semantic audit only. Do not compute a city median, fit a correction, or map a result to
`accom_3_star`.

Record two judgements for the best candidate:

- `strictStatus`: found only when the same source evidence explicitly states a named exact-city 3-star property,
  two adults/two guests, one room, a numeric non-from nightly price, and tax/fee treatment.
- `selectorRelaxedStatus`: found when the source identifies a named exact-city 3-star property, a numeric
  non-from nightly price, tax/fee treatment, and an explicit two-adult/one-night booking selector, but omits
  the words proving one room. The query text is not itself evidence. Reject any source showing multiple rooms,
  per-person pricing, dorm/hostel or suite-only pricing, a generic city average, nearby city, wrong class,
  from/starting/lowest price, login-only price, or unknown tax.

The relaxed status is a hypothesis label, not an observed two-person room quote. Do not silently upgrade it to
`explicit_two_adults`.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-selector-occupancy-audit-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measure": {
    "strictStatus": "found|not_found",
    "selectorRelaxedStatus": "found|not_found",
    "propertyName": null,
    "value": null,
    "currency": null,
    "unit": "per_room_per_night",
    "occupancyBasis": "explicit_two_adults_one_room|selector_two_adults_one_night|unknown",
    "class": "3_star|unknown",
    "sourceUrl": null,
    "sourceTitle": null,
    "evidenceText": null,
    "taxStatus": "included|excluded|unknown",
    "referencePeriod": null,
    "searchQuery": null,
    "reason": ""
  },
  "telemetry": {
    "searchesAttempted": 3,
    "searchOperations": 0,
    "directReads": 0,
    "retries": 0,
    "fallbackSources": 0,
    "arithmeticOperations": 0,
    "currencyConversions": 0,
    "crossCityEvidence": 0
  }
}
```

Do not add commentary outside JSON. The relaxed status must remain clearly labelled as a semantic hypothesis
until independently compared with explicit one-room property quotes.
