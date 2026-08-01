# v5 Experiment 041 — paired one-star source/calibration search

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered searches:

1. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} 1 star hotel average price`
2. `site:booking.com {{CITY}} {{COUNTRY}} 1-star hotel 2 adults 1 room price`
3. `site:hotels.com {{CITY}} {{COUNTRY}} 1-star hotel 2 adults 1 room price`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer star class
or occupancy. This experiment tests whether a broad city-level one-star statistic can be paired with an
independent explicit two-adult one-star observation in the same production-shaped call.

Return two separate evidence channels:

- `cityStatistic`: a BudgetYourTrip exact-city one-star average only when the page identifies the city, one-star
  class, numeric non-`from` central statistic, sample size or reference period, and source currency. Occupancy
  may be `unknown_source_default`; this row is calibration evidence only, never an observed two-adult product
  anchor.
- `explicitQuotes`: named one-star property quotes only when the same evidence identifies the exact city and
  one-star class, explicit two-adult/one-room occupancy, a numeric non-`from` nightly price, named currency,
  date/window, and source URL/title. Reject generic hotel results, class-ambiguous properties, ranges,
  lowest/from prices, and occupancy inferred from the query.

If a channel fails, return `not_found` with the exact reason. Do not combine values, compute a ratio, or promote
any row to `accom_1_star`.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-one-star-paired-calibration-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "cityStatistic": {
    "status": "found|not_found",
    "value": 0,
    "currency": "ISO-4217",
    "unit": "per_room_per_night",
    "occupancyBasis": "unknown_source_default",
    "class": "1_star",
    "statistic": "city_average",
    "sampleSize": 0,
    "sourceUrl": "https://...",
    "sourceTitle": "...",
    "evidenceText": "short quote or exact snippet",
    "referencePeriod": "...",
    "searchQuery": "exact query issued",
    "reason": "..."
  },
  "explicitQuotes": [
    {
      "propertyName": "...",
      "status": "found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "explicit_two_adults",
      "class": "1_star",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "referencePeriod": "...",
      "searchQuery": "exact query issued"
    }
  ],
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

Do not add commentary outside JSON. All arithmetic, FX, calibration, aggregation, and evidence-basis labels
remain deterministic local operations after a source contract is accepted.
