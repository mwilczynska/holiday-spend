# v5 Experiment 031 — single-city 1-star occupancy calibration prompt

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly three independent search queries:

1. A Momondo-restricted query for an exact city-wide one-star hotel average.
2. A Skyscanner-restricted query for an exact city-wide one-star result explicitly using two adults and one
   room, or an equivalent explicit occupancy statement.
3. An Expedia-restricted query for an exact city-wide one-star trend or average explicitly using two adults and
   one room, or an equivalent explicit occupancy statement.

Search only. Do not open pages, retry, calculate, convert currency, average sources, or use another city.
Accept a row only when the result identifies the exact city and 1-star class, provides a numeric non-`from`
nightly room price, a named currency, a source URL/title, a reference date/window, and the required occupancy
basis. Record Momondo's `source_default_room` or `unknown` basis exactly; never upgrade it. For Skyscanner or
Expedia, accept `explicit_two_adults` only when the snippet itself states two adults/one room (or equivalent).
Reject properties, ranges, lowest/from prices, regional/country values, district-only results, and snippets
without class, date, or occupancy identity. Retain each source independently; do not combine or correct values.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-one-star-occupancy-calibration-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "momondo_one_star_source_default": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancyBasis": "source_default_room|unknown|explicit_two_adults",
      "class": "1_star",
      "referencePeriod": "...",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "searchQuery": "exact query issued",
      "reason": "..."
    },
    "skyscanner_one_star_explicit_two_adults": {
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
    "expedia_one_star_explicit_two_adults": {
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

This is a calibration experiment, not a production mapping. A Momondo source-default or unknown row is not an
observed two-adult value. A row is an explicit calibration observation only when the source text itself states
the two-adult/one-room basis. Do not fit a correction from this tranche; a definition-matched panel requires at
least 30 cities, including 10 locked holdouts.
