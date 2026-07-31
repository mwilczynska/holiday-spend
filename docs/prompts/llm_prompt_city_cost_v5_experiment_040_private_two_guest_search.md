# v5 Experiment 040 — explicit private-hostel two-guest search

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly two targeted searches, in order:

1. `site:hostelworld.com {{CITY}} {{COUNTRY}} private room 2 guests price per night`
2. `site:booking.com {{CITY}} {{COUNTRY}} hostel private room 2 adults price per night`

Do not open interactive booking engines, use login-only pages, retry, use another city, calculate, convert
currencies, or infer occupancy from a generic “private room” label. This experiment tests whether search snippets
can expose an explicit two-guest private-hostel price; it is not a request for an estimate.

Accept a row only when the evidence identifies the exact city, a hostel/private-room class, an explicit
two-adult or two-guest basis, a numeric non-`from` central price in a named ISO currency, one-night basis, a
source URL/title, reference period or dates, and the exact query. A named-property quote is acceptable only if
the property is clearly a hostel and the evidence states two adults/two guests and one night. Reject ranges,
lowest/from prices, generic city or country averages, ambiguous occupancy, event-only dates, packages, and
search results whose page would require login. If both searches fail, return `not_found` with exact reasons.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-private-two-guest-search-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measure": {
    "status": "found|not_found",
    "value": 0,
    "currency": "ISO-4217",
    "unit": "per_private_room_per_night",
    "occupancyBasis": "two_adults|two_guests",
    "class": "hostel_private_room",
    "statistic": "property_quote|city_average|city_median",
    "sourceUrl": "https://...",
    "sourceTitle": "...",
    "evidenceText": "short quote or exact snippet",
    "referencePeriod": "...",
    "searchQuery": "exact query that produced the row",
    "reason": "..."
  },
  "telemetry": {
    "searchesAttempted": 2,
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

Do not add commentary outside JSON. Do not upgrade source-default occupancy to two guests. Arithmetic and FX
conversion remain deterministic local operations after a source contract is accepted.
