# v5 Experiment 045 — Trip.com activity definitions

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three Trip.com-restricted searches, in order:

1. `site:trip.com/things-to-do {{CITY}} {{COUNTRY}} attraction ticket adult price`
2. `site:trip.com/things-to-do {{CITY}} {{COUNTRY}} half day group tour adult price duration`
3. `site:trip.com/things-to-do {{CITY}} {{COUNTRY}} full day premium tour adult price duration`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer duration,
party size, or premium status from the query. Preserve exact Trip.com source URLs/titles and evidence snippets.

Apply the frozen definitions strictly:

- `activities_budget`: an exact-city standard paid-attraction adult ticket, per person, non-`from` price;
- `activities_mid_range`: an exact-city half-day group activity, explicit 3–6 hour duration, group/shared basis,
  per-person/adult non-`from` price;
- `activities_high_end`: an exact-city full-day premium activity, explicit 6–12 hour duration, premium/private
  or clearly high-end basis, per-person/adult non-`from` price.

Tax status must be included, excluded, or explicitly unknown; unknown is retained but cannot be counted as a
compatible observed row. Reject ranges, lowest/from prices, generic city guides, wrong duration, other cities,
and party/price bases inferred from the query. Do not double prices or map any row to a two-person product value.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-trip-activity-definitions-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "activities_budget": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_ticket","basis":"adult_ticket","durationHours":null,"partyBasis":"individual_ticket","taxStatus":"included|excluded|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","referencePeriod":"...","searchQuery":"...","reason":"..."},
    "activities_mid_range": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_activity","basis":"half_day_group","durationHours":0,"partyBasis":"group|group_equivalent","taxStatus":"included|excluded|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","referencePeriod":"...","searchQuery":"...","reason":"..."},
    "activities_high_end": {"status":"found|not_found","value":0,"currency":"ISO-4217","unit":"per_person_activity","basis":"full_day_premium","durationHours":0,"partyBasis":"individual|group|group_equivalent","taxStatus":"included|excluded|unknown","sourceUrl":"https://...","sourceTitle":"...","evidenceText":"...","referencePeriod":"...","searchQuery":"...","reason":"..."}
  },
  "telemetry": {"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. This is source-feasibility evidence only; deterministic local code handles
FX, two-person scaling, and evidence-basis metadata after validation.
