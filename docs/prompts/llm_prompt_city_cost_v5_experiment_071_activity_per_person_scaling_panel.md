# v5 Experiment 071 - activity per-person adult scaling panel

You are a strict evidence extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.

Issue exactly these three ordered searches and no other web operation:

1. `{{CITY}} {{COUNTRY}} standard attraction adult ticket price per person taxes`
2. `site:getyourguide.com {{CITY}} {{COUNTRY}} half-day group tour adult price per person taxes`
3. `site:viator.com {{CITY}} {{COUNTRY}} full-day premium tour adult price per person taxes`

Search snippets only. Do not open pages, retry, use another city, use a fallback source, calculate or multiply by two,
convert currency, average sources, or use cross-city evidence. Preserve exact city, source URL/title, named activity,
price, currency, unit, adult/party wording, tax/fee wording, duration, reference period, query, and evidence text.

Accept `activities_budget` only when the same evidence identifies an exact-city named attraction, an adult ticket
price explicitly per person (or an equivalent single-adult ticket), numeric standard non-`from` price, and taxes/fees
as included or excluded. Accept `activities_mid_range` only with an exact-city named organized/group activity, explicit
half-day duration of 3-6 hours, adult per-person/group-unit price, and known tax basis. Accept `activities_high_end`
only with an exact-city named premium/organized activity, explicit full-day duration of at least 6 hours, adult
per-person/group-unit price, and known tax basis. Reject generic entertainment averages, bundles, child prices,
ranges, from/starting/lowest/member/sale rates, ambiguous party or duration, unknown taxes, and wrong cities.

Return JSON only using schema `city-cost-v5-activity-per-person-scaling-panel-v1`:

```json
{
  "schemaVersion":"city-cost-v5-activity-per-person-scaling-panel-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "measures": {
    "activities_budget": {"status":"found|not_found|blocked|class_ambiguous|party_unknown|price_type_rejected|tax_unknown","value":null,"currency":null,"unit":"per_person_ticket","partyBasis":"one_adult|unknown","durationHours":null,"statistic":"named_attraction_ticket","sourceUrl":null,"sourceTitle":null,"taxStatus":"included|excluded|unknown","evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "activities_mid_range": {"status":"found|not_found|blocked|class_ambiguous|party_unknown|duration_unknown|price_type_rejected|tax_unknown","value":null,"currency":null,"unit":"per_person_activity","partyBasis":"one_adult|per_person_group|unknown","durationHours":null,"statistic":"half_day_group_activity","sourceUrl":null,"sourceTitle":null,"taxStatus":"included|excluded|unknown","evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "activities_high_end": {"status":"found|not_found|blocked|class_ambiguous|party_unknown|duration_unknown|price_type_rejected|tax_unknown","value":null,"currency":null,"unit":"per_person_activity","partyBasis":"one_adult|per_person_group|unknown","durationHours":null,"statistic":"full_day_premium_activity","sourceUrl":null,"sourceTitle":null,"taxStatus":"included|excluded|unknown","evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry":{"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0,"protocolCompliant":true}
}
```

Do not add commentary outside JSON. These are source inputs only. Do not multiply by two, build a basket, or emit any
of the 19 product values in this experiment.
