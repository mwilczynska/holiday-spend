# v5 Experiment 037 — single-city definition-matched activity anchors

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly three searches restricted to BudgetYourTrip.com:

1. An exact-city low-cost paid attraction or entrance-ticket price suitable for two adult tickets.
2. An exact-city half-day group activity/tour price with duration explicitly stated.
3. An exact-city full-day premium activity/tour price with duration and premium basis explicitly stated.

Search only; do not open pages, retry, calculate, convert currency, average, or use another city. Accept source
rows only when the evidence identifies the exact city and activity, gives a numeric non-`from` price, named
currency, party basis, duration/class basis, source URL/title, and date/window. Preserve whether the source price
is per person or group; do not multiply by two. Reject generic daily entertainment averages, total-trip budgets,
hotel/food/transport values, properties, ranges/lowest/from prices, and activities whose duration or premium
basis is not explicit.

Return JSON only with schema `city-cost-v5-activity-definition-matched-v1` and measures:
`activity_budget_ticket`, `activity_mid_half_day`, and `activity_high_full_day`. Each row must include `status`,
`value`, `currency`, `unit`, `partyBasis`, `duration`, `activityBasis`, `referencePeriod`, `sourceUrl`,
`sourceTitle`, `evidenceText`, `searchQuery`, and `reason`, plus telemetry showing exactly three searches and
zero reads/retries/fallback/arithmetic/FX/cross-city evidence.

This is ground-truth/source feasibility, not a product mapping. `activities_free = 0` is definitional. Do not
map a generic entertainment row to the frozen activity estimands; any later deterministic two-person conversion
must preserve the source party basis and pass independent held-out validation.
