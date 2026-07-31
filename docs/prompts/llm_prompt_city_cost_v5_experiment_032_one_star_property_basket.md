# v5 Experiment 032 — single-city explicit 1-star property basket prompt

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly four search queries, one each restricted to Booking.com, Hotels.com, Trip.com, and Agoda. Ask for
1-star hotels in the exact city with two adults, one room, and a nightly price. Search only; do not open pages,
retry, calculate, convert currency, average sources, or use another city.

Return every qualifying property snippet, not a city average. Accept a property only when the same evidence
identifies the exact city, the 1-star class (or an unambiguous one-star rating), two adults/one room (or an
equivalent explicit occupancy statement), a numeric non-`from` nightly room price, named currency, source URL or
title, and a date/window. Reject lowest/from prices, ranges, generic city averages, properties without a class,
district-only results, and occupancy inferred from the query. Keep each source and property independently; do
not compute a median or choose a representative value.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-one-star-property-basket-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "propertyQuotes": [
    {
      "propertyName": "...",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "explicit_two_adults",
      "class": "1_star",
      "referencePeriod": "...",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "searchQuery": "exact query issued"
    }
  ],
  "rejected": [{"source": "...", "reason": "..."}],
  "telemetry": {
    "searchesAttempted": 4,
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

This is a retrieval feasibility experiment. A property basket is not yet a city-level product value. Do not
average, model, or map any quote to `accom_1_star`; a production basket would require a pre-registered statistic,
definition-matched validation, and at least 30 cities including 10 locked holdouts.
