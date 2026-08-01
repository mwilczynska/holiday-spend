# v5 Experiment 043 — Google Hotels one-star property search

You are a strict ground-truth extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three Google-Hotels-restricted queries, in order:

1. `site:google.com/travel/hotels {{CITY}} {{COUNTRY}} 1-star hotel 2 adults price`
2. `site:google.com/travel/hotels {{CITY}} {{COUNTRY}} "1 star hotel" "2 guests" nightly`
3. `site:google.com/travel/hotels {{CITY}} {{COUNTRY}} 1-star hotel taxes fees room`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer class or
occupancy from the query. Search results may show a Google Hotels entity or prices page; preserve that URL.

Accept a property quote only when the same Google Hotels evidence identifies the exact property and city, states
1-star (or an unambiguous one-star label), explicitly states two adults/two guests and one room, gives a numeric
non-`from` nightly price, names the currency, and states tax/fee treatment or includes an all-in price label.
Reject generic city averages, nearby cities, other star classes, ranges, lowest/from prices, room listings with
unknown occupancy, and snippets that do not reconcile the exact city/property. Keep each property independently;
do not compute a median or map a quote to `accom_1_star`.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-google-hotels-one-star-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "propertyQuotes": [
    {
      "propertyName": "...",
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "explicit_two_adults",
      "class": "1_star",
      "sourceUrl": "https://www.google.com/travel/hotels/...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "taxStatus": "included|excluded|unknown",
      "referencePeriod": "...",
      "searchQuery": "exact query issued",
      "reason": "..."
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

Do not add commentary outside JSON. A Google Hotels property row is ground-truth candidate evidence only; no
city-level statistic, basket, calibration, or product mapping is permitted in this experiment.
