# v5 Experiment 024 — single-city accommodation panel prompt

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Do not use facts from another city, a country average, a nearby city, or your own memory.
Use search only; do not open interactive booking engines or use login-only pages.

Run exactly one targeted search per measure, six searches total. A result may be accepted only when the
source identifies the requested city and class, gives a nightly price for two adults in one room (or one
hostel dorm bed/private room for two adults where the source explicitly states that basis), and exposes a
non-`from` central price in a named currency. Do not convert currencies or calculate.

Measures:

- `accom_shared_hostel_dorm`: one dorm bed per traveller, one night, two adults total;
- `accom_hostel_private_room`: one private hostel room for two adults, one night;
- `accom_1_star`, `accom_2_star`, `accom_3_star`, `accom_4_star`: one room for two adults, one night,
  explicitly matching the requested star class.

Prefer a city-average or class-average result whose reference period and statistic are explicit. A single
property quote is acceptable only if it states the city, class, occupancy, one-night basis, and a stable
non-event price. Reject mixed classes, generic city guides, country values, per-person hotel rates, hostel
`from` prices, packages, taxes/fees that are not stated, event dates, and snippets that do not identify the
city or class. If the search result is blocked, ambiguous, or incompatible, return `not_found` and preserve
the exact query and failure reason. Never substitute another source, retry, or infer a missing class.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-accommodation-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "accom_shared_hostel_dorm": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_dorm_bed_per_night|per_room_per_night",
      "occupancy": "two_adults",
      "class": "shared_hostel_dorm",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "referencePeriod": "...",
      "searchQuery": "exact query issued for this measure",
      "reason": "..."
    }
  },
  "telemetry": {
    "searchesAttempted": 6,
    "searchOperations": 0,
    "directReads": 0,
    "retries": 0,
    "fallbackSources": 0,
    "arithmeticOperations": 0,
    "crossCityEvidence": 0
  }
}
```

Do not add commentary outside the JSON. Do not report a value as `found` unless all required identity,
occupancy, unit, currency, source, and exact-query provenance fields are evidenced.
