# v5 Experiment 030 — single-city 1-star source cascade prompt

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly two search queries: one Momondo-restricted and one KAYAK-restricted query for a city-wide
one-star hotel average. Search only; do not open pages, retry, calculate, convert currency, or use another city.

Accept a row only when the result identifies the exact city and 1-star class, provides a numeric non-`from`
central nightly room price, a named currency, a source URL/title, and a reference date/window. Record occupancy
as `explicit_two_adults`, `source_default_room`, or `unknown`; do not upgrade source-default or unknown to
two-adult evidence. Reject properties, ranges, lowest/from prices, regional/country values, district-only
results, and snippets with no class or date identity. If both sources qualify, retain both independently and do
not average them in the model.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-one-star-source-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "one_star_candidate_momondo": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "explicit_two_adults|source_default_room|unknown",
      "class": "1_star",
      "referencePeriod": "...",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "searchQuery": "exact query issued",
      "reason": "..."
    },
    "one_star_candidate_kayak": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "explicit_two_adults|source_default_room|unknown",
      "class": "1_star",
      "referencePeriod": "...",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "searchQuery": "exact query issued",
      "reason": "..."
    }
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

Do not add commentary outside JSON. This experiment tests retrieval only. A source-default or unknown
occupancy candidate cannot be used as an observed two-adult `accom_1_star` value without separate calibration.
