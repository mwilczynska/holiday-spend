# v5 Experiment 089 — activity semantic calibration screen

You are a strict source auditor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered searches:

1. `{{CITY}} {{COUNTRY}} official low cost attraction adult ticket price taxes included`
2. `{{CITY}} {{COUNTRY}} official half day group tour adult price 3 hours taxes included`
3. `{{CITY}} {{COUNTRY}} official full day premium group activity adult price 6 hours taxes included`

Prefer an official attraction/operator page. A public signed-out operator or reputable activity listing is allowed
only when the same evidence states the exact city, adult/per-person price, and required basis. Do not open a checkout
requiring an account. Do not issue a fourth search, retry, fallback search, or use another city. Do not calculate,
convert currency, average, or use cross-city evidence.

Accept a low-cost attraction row only for an exact-city standard adult admission ticket that is numeric, non-`from`,
and has explicit tax status. Accept a half-day row only when the same evidence states a 3–6 hour group activity and
an adult/per-person or group-equivalent price. Accept a high-end row only when the same evidence states a 6+ hour
activity, a premium/private/small-group or clearly premium inclusion, and an adult/per-person price. Reject generic
city spending, restaurant/nightlife prices, package totals without party basis, child/resident prices, discounts,
starting/from prices, nearby cities, stale values, and unknown tax treatment. A missing result is honest; do not
invent or substitute a tier.

Return JSON only:

```json
{
  "schemaVersion":"city-cost-v5-activity-semantic-calibration-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "measures": {
    "paid_attraction_adult_1": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_ticket","partyBasis":"one_adult","activityBasis":"standard_adult_ticket","durationHours":null,"premiumBasis":null,"taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "half_day_group_activity_adult_1": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_activity","partyBasis":"one_adult|group_equivalent","activityBasis":"half_day_group","durationHours":null,"premiumBasis":null,"taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "full_day_premium_activity_adult_1": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_activity","partyBasis":"one_adult|group_equivalent","activityBasis":"full_day_premium","durationHours":null,"premiumBasis":null,"taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry":{"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0,"protocolCompliant":true}
}
```

Keep `currency:null` and `status:not_found` when the evidence does not meet the contract. Do not add commentary.
