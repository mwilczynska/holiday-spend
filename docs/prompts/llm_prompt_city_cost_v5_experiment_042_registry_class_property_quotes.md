# v5 Experiment 042 — registry-class plus explicit two-adult property quotes

You are a strict ground-truth extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
The property manifest below is frozen from an official tourism/property register. The register evidence is the
authoritative class basis; do not require Booking's search snippet to repeat the star label.

Frozen one-star manifest:

{{PROPERTY_MANIFEST}}

Issue exactly one search query per listed property, in manifest order:
`"PROPERTY NAME" {{CITY}} booking 2 adults 1 room price per night`

Search only. Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer
occupancy from the query. A property quote may be accepted only when the search evidence identifies the exact
listed property and city, gives a numeric non-`from` nightly room price in a named ISO currency, and explicitly
states two adults/two guests and one room (or an equivalent maximum occupancy of two). The register class basis
must be copied unchanged into the output; do not upgrade a property whose identity is ambiguous or whose result
is a different property, guesthouse, hostel, or nearby city.

Reject lowest/from prices, ranges, dates without a usable nightly amount, taxes/fees with unknown treatment,
generic city averages, and prices where the exact listed property cannot be reconciled. Keep every property
independent. Do not compute a basket median or map any quote to a city value.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-registry-class-property-quotes-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "classBasis": {
    "sourceId": "...",
    "sourceTitle": "...",
    "sourceUrl": "https://...",
    "retrievalDate": "YYYY-MM-DD",
    "classRule": "official register says exact 1-star category",
    "manifestProperties": ["..."]
  },
  "propertyQuotes": [
    {
      "propertyId": "...",
      "propertyName": "...",
      "class": "1_star",
      "classEvidence": "official register record supplied in manifest",
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "explicit_two_adults",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "referencePeriod": "...",
      "searchQuery": "exact query issued",
      "reason": "..."
    }
  ],
  "telemetry": {
    "searchesAttempted": 0,
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

Do not add commentary outside JSON. Class identity comes from the supplied official registry; price, occupancy,
currency, date, and taxes/fees come from the independent property search and remain separately evidenced.
