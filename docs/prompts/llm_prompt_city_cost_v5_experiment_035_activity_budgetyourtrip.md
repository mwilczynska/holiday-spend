# v5 Experiment 035 — single-city activity spend source prompt

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly two searches restricted to BudgetYourTrip.com:

1. A city travel-cost page for the exact city showing sightseeing activities, entertainment, and entrance-ticket
   spend per person per day.
2. The exact city's budget/mid-range/luxury entertainment or activities table, if separately indexed.

Search only; do not open pages, retry, calculate, convert currency, average, or use another city. Accept a row
only when the evidence identifies the exact city, activity/entertainment scope, numeric daily value, named
currency, party basis, and reference date/window. Prefer explicit `per_person_per_day`; do not silently multiply
by two. Accept budget/mid/luxury rows only when the source labels the spend tier itself. Reject total-trip costs,
food/transport/hotel rows, tour/property prices, ranges, and generic city or country values.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-activity-budgetyourtrip-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "activity_average_per_person_day": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_per_day","tier":"average","scope":"sightseeing_activities_entertainment_entrance_tickets","referencePeriod":"...","partyBasis":"one_person|two_people|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","searchQuery":"...","reason":"..."},
    "activities_budget_per_person_day": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_per_day","tier":"budget","scope":"entertainment_or_sightseeing","referencePeriod":"...","partyBasis":"one_person|two_people|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","searchQuery":"...","reason":"..."},
    "activities_mid_per_person_day": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_per_day","tier":"mid_range","scope":"entertainment_or_sightseeing","referencePeriod":"...","partyBasis":"one_person|two_people|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","searchQuery":"...","reason":"..."},
    "activities_high_per_person_day": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_per_day","tier":"high_end","scope":"entertainment_or_sightseeing","referencePeriod":"...","partyBasis":"one_person|two_people|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","searchQuery":"...","reason":"..."}
  },
  "telemetry":{"searchesAttempted":2,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

This is source-feasibility evidence only. `activities_free = 0` is definitional and is not searched. Do not
multiply, model, or map any row to the two-traveller product values in the model. Deterministic code may later
scale a validated one-person input, but the source basis must remain explicit and any tier model needs a
definition-matched 30-city/10-holdout validation.
