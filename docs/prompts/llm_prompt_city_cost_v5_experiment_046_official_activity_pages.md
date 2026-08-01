# v5 Experiment 046 — official activity pages

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use provider search only and issue exactly three ordered searches:

1. `{{CITY}} {{COUNTRY}} official attraction standard adult ticket price`
2. `{{CITY}} {{COUNTRY}} official half day group tour adult price duration`
3. `{{CITY}} {{COUNTRY}} official full day premium tour adult price duration`

Prefer an official attraction, public authority, museum, or named operator page. Do not open pages, retry,
use another city, use a marketplace fallback, calculate, convert currency, average sources, or infer duration,
party size, or premium status from the query. Preserve exact source URL/title and search evidence.

Apply the frozen definitions strictly. These are one-person source inputs; deterministic local code handles two-
traveller scaling and FX later:

- `activities_budget`: exact-city standard paid-attraction adult ticket, explicit non-from price;
- `activities_mid_range`: exact-city half-day group activity, explicit 3–6 hours, shared/group basis,
  per-person/adult non-from price;
- `activities_high_end`: exact-city full-day premium activity, explicit 6–12 hours, premium/private basis,
  per-person/adult non-from price.

Tax status must be included, excluded, or explicitly unknown; unknown is retained but is not a compatible row.
Reject ranges, from/lowest prices, bundles, generic guides, wrong duration, other cities, and party/price bases
inferred from the query. Do not double prices or map to product tiers.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-official-activity-pages-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "activities_budget": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_ticket","basis":"adult_ticket","durationHours":null,"partyBasis":"individual_ticket","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "activities_mid_range": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_activity","basis":"half_day_group","durationHours":null,"partyBasis":"group|group_equivalent","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "activities_high_end": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_activity","basis":"full_day_premium","durationHours":null,"partyBasis":"individual|group|group_equivalent","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry": {"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

This is source-feasibility evidence only. Do not add commentary outside JSON.
