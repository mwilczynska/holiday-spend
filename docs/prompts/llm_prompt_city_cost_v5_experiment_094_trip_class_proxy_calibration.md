# Experiment 094 prompt — Trip.com class proxy calibration

You are the target cheap GPT-5.6 Luna-class web researcher. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
This is a source-feasibility and calibration experiment, not a request to invent a product value.

Issue exactly these three searches, in order, and no other searches:

1. `site:trip.com/hotels/star2/city {{CITY}} {{COUNTRY}} Trip.com 2-star weekday average price`
2. `site:trip.com/hotels/star3/city {{CITY}} {{COUNTRY}} Trip.com 3-star weekday average price`
3. `site:trip.com/hotels/star4/city {{CITY}} {{COUNTRY}} Trip.com 4-star weekday average price`

You may read only public pages returned by those searches. Do not retry, add a fallback source, calculate, average,
convert currency, infer occupancy, infer tax treatment, or use evidence from another city. A page or snippet that says
“from”, “starting at”, a range, a package total, a named property rather than a city-class statistic, or a different
city/class is not a proxy row.

For each class, retain a row only when the same evidence identifies the exact city and class and gives a numeric
weekday average (not a weekend value) for a room per night. Record the displayed currency exactly, even if it is a
viewer currency. Mark occupancy as `unknown` and tax status as `unknown`; these are deliberate properties of this
proxy and must not be upgraded. Keep any weekend value as evidence only and do not combine it with the weekday value.

Return JSON only in this shape:

```json
{
  "schemaVersion": "city-cost-v5-trip-class-proxy-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "classes": {
    "2_star": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217 or null",
      "unit": "per_room_per_night",
      "basis": "source_defined_proxy",
      "statistic": "source_reported_weekday_average",
      "occupancyBasis": "unknown",
      "taxStatus": "unknown",
      "weekendValue": null,
      "sourceUrl": "https://... or null",
      "sourceTitle": "... or null",
      "evidenceText": "verbatim-short paraphrase with city, class, weekday value, and currency",
      "referencePeriod": "... or null",
      "searchQuery": "exact registered query",
      "reason": "..."
    },
    "3_star": {},
    "4_star": {}
  },
  "telemetry": {
    "searchesAttempted": 3,
    "searchOperations": 3,
    "directReads": 0,
    "retries": 0,
    "fallbackSources": 0,
    "arithmeticOperations": 0,
    "currencyConversions": 0,
    "crossCityEvidence": 0,
    "protocolCompliant": true
  }
}
```

Use `status: "not_found"` and null value when the contract is not met. Never fill a missing class with another
class or an estimate. This artifact is a labelled proxy only. The deterministic audit will compare it with already
observed Expedia rows; you must not perform that comparison yourself.
