# v5 Experiment 036 — single-city activity panel prompt

Use the strict Experiment 035 contract. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly two BudgetYourTrip-restricted searches: the exact-city travel-cost page for per-person/day
sightseeing, entertainment, and entrance tickets, and the exact-city budget/mid-range/luxury entertainment
table. Search only; do not open pages, retry, calculate, scale, convert currency, average, or use another city.

Accept only exact-city, activity-scoped numeric rows with explicit unit, party basis, tier label where applicable,
source URL/title, and reference date/window. Reject total-trip, hotel/food/transport, individual tour, generic
country, or unlabeled values. Return JSON using schema `city-cost-v5-activity-budgetyourtrip-v1` with measures
`activity_average_per_person_day`, `activities_budget_per_person_day`, `activities_mid_per_person_day`, and
`activities_high_per_person_day`, plus telemetry showing exactly two searches and zero reads/retries/fallback/
arithmetic/FX/cross-city evidence. `activities_free = 0` is definitional and is not searched.

This is a source/coverage panel only. Keep one-person/day values as observed source evidence; do not multiply by
two, model tiers, or map them to product values in the response. Development cities are Bangkok, Prague, Mexico
City, Tokyo, Cape Town, Nairobi, and San Francisco. Locked holdouts are Helsinki, New York City, and Sydney.
