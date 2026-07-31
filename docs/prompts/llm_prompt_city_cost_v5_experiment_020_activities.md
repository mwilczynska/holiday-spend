# City-cost v5 experiment 020 — one-city activity anchors

You are extracting activity price observations for **one city only**. Do not inspect, mention, infer from,
or substitute another city. Use provider web search only; do not open arbitrary booking URLs or direct pages
in this experiment. Issue exactly three targeted searches, one for each measure below. Do not retry a query.

The goal is source facts, not estimates. Do not perform arithmetic, FX conversion, tier construction, or
cross-city modelling. If the required city-specific evidence is not present, return `not_found`. A blocked,
rate-limited, login-only, paywalled, promotional, range-only, package, or incompatible-duration result is not
found. Do not turn a source failure into a plausible estimate.

## Required measures

1. `paid_attraction_adult_1`: one standard adult ticket to a normal low-cost paid attraction in {{city}},
   such as a museum, landmark, garden, or public cultural site. Accept only an explicit standard adult entry
   price, not a range, discount, tour bundle, or child/student rate.
2. `half_day_group_activity_adult_1`: one adult place on a shared/group organised activity in {{city}}
   lasting roughly 3–5 hours. Accept only an explicit per-person/adult price and duration.
3. `full_day_premium_activity_adult_1`: one adult place on a premium organised activity in {{city}} lasting
   roughly 6–10 hours. Accept only an explicit per-person/adult price, duration, and premium/organised basis.

Use one query per measure, restricted to a public source likely to expose the exact fact. Prefer official
attraction/operator pages or a publicly visible signed-out listing. The search evidence must identify the city,
activity or attraction, adult/per-person basis, duration where relevant, central numeric price, currency, and
source URL. Do not use a `from` price, a range endpoint, a deposit, an unlabelled package total, a price for
another city, or an amount requiring arithmetic.

Return exactly this JSON shape and no surrounding prose:

```json
{
  "city": "{{city}}",
  "country": "{{country}}",
  "referenceDate": "YYYY-MM-DD",
  "searchOnly": {"queriesAttempted": 3, "directPageReads": 0},
  "measures": {
    "paid_attraction_adult_1": {"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_person_ticket","activityName":"","durationHours":null,"sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "half_day_group_activity_adult_1": {"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_person_activity","activityName":"","durationHours":0.0,"sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "full_day_premium_activity_adult_1": {"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_person_activity","activityName":"","durationHours":0.0,"sourceUrl":null,"searchQuery":"","resultEvidence":""}
  },
  "outcome":"accepted|partial|no_result|blocked",
  "notes":""
}
```

For `not_found` or `blocked`, set value, currency, activityName, durationHours, sourceUrl, searchQuery, and
resultEvidence to null (except retain the attempted query in `searchQuery` if available). For `found`, never
leave evidence fields blank. The only accepted evidence is the search result itself; do not claim that a page
was read when it was not.
