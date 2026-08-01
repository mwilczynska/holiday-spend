# v5 Experiment 050 — tax-resolved official activity ticket

You are a strict research extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly one search:

`{{CITY}} {{COUNTRY}} official attraction adult admission ticket price taxes included`

Prefer an official attraction, museum, public authority, or named venue. Do not open pages, retry, use another
city, calculate, convert currency, or infer adult or tax treatment from the query. Preserve exact URL/title and
the evidence snippet.

Accept only an exact-city standard paid-attraction adult ticket with a numeric non-from price, named currency,
explicit adult basis, and explicit tax/fee treatment (`included` or `excluded`). Reject ranges, tours, bundles,
discounts, generic guides, unknown taxes, and prices whose party basis is inferred from the query. This is a
one-person source input; do not double or map to the two-traveller product value.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-tax-resolved-activity-ticket-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measure": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_ticket","basis":"adult_ticket","partyBasis":"individual_ticket","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry": {"searchesAttempted":1,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. This is source-feasibility evidence only.
