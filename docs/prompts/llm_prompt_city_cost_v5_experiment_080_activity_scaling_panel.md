# v5 Experiment 080 prompt — per-person activity scaling panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Issue exactly two ordered searches and no other web operations:

1. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} budget mid-range luxury entertainment per person per day`
2. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} sightseeing activities entertainment entrance tickets per person per day`

Do not open pages, retry, use another city, use another source, calculate, convert currency, or use cross-city evidence.

Accept the three tier rows only when the exact city/country source result states a numeric non-`from` Budget, Mid-Range,
and Luxury entertainment/activity amount, in USD, explicitly per person per day, with source URL/title and reference
period. The second search may provide an exact-city average activity row, but it is auxiliary and must not replace a
missing tier. Preserve the source's wording; do not double the values in the response.

Reject nearby/wrong cities, generic vacation totals, tours or properties, ranges, per-trip prices, missing party basis,
missing currency, and arithmetic. Missing or blocked rows remain `not_found` or `blocked`.

Return schema `city-cost-v5-activity-scaling-panel-v1` with `activity_average_per_person_day`,
`activities_budget_per_person_day`, `activities_mid_per_person_day`, and `activities_high_per_person_day` measures
plus the standard telemetry object. Do not add commentary.
