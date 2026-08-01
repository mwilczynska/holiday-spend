# v5 Experiment 044 — operator-source activity definitions

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered searches:

1. `site:getyourguide.com {{CITY}} adult attraction ticket price`
2. `site:viator.com {{CITY}} half day group tour adult price`
3. `site:getyourguide.com {{CITY}} full day premium tour adult price`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer duration,
party size, or premium status from the query. Search snippets may point to operator pages, but preserve the exact
source URL/title and evidence.

Return one row for each frozen activity definition:

- `activities_budget`: one adult ticket to a standard low-cost paid attraction (a source input later scaled
  deterministically for two travellers). Accept a per-person adult ticket
  only when the exact city/attraction and ticket basis are explicit; exclude tours, bundles, and from prices.
- `activities_mid_range`: one adult place on a half-day group activity. Require explicit 3–6 hour duration,
  group/shared basis (or a clearly stated group-equivalent), per-person/adult price, exact city, and non-from
  price.
- `activities_high_end`: one adult place on a full-day premium activity. Require explicit 6–12 hour duration,
  premium/private or clearly high-end basis, per-person/adult price, exact city, and non-from price.

Tax treatment must be included, excluded, or explicitly stated unknown; unknown tax status is retained but cannot
be used as a compatible observed row. Reject generic entertainment averages, city guides, ranges, lowest/from
prices, wrong durations, other cities, and occupancy/party bases inferred from the query. Do not double prices.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-activity-operator-sources-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "activities_budget": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_person_ticket",
      "basis": "adult_ticket",
      "durationHours": null,
      "partyBasis": "individual_ticket",
      "taxStatus": "included|excluded|unknown",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "referencePeriod": "...",
      "searchQuery": "exact query issued",
      "reason": "..."
    },
    "activities_mid_range": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_person_activity",
      "basis": "half_day_group",
      "durationHours": 0,
      "partyBasis": "group|group_equivalent",
      "taxStatus": "included|excluded|unknown",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "referencePeriod": "...",
      "searchQuery": "exact query issued",
      "reason": "..."
    },
    "activities_high_end": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_person_activity",
      "basis": "full_day_premium",
      "durationHours": 0,
      "partyBasis": "individual|group|group_equivalent",
      "taxStatus": "included|excluded|unknown",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "referencePeriod": "...",
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

Do not add commentary outside JSON. Activity rows are source-feasibility evidence only; no two-person scaling,
aggregation, or product mapping is performed by the extractor.
