# v5 Experiment 081 prompt — activity one-call repeatability

Use the exact Experiment 080 prompt and research exactly one city: `{{CITY}}, {{COUNTRY}}`. This is an independent
repeatability call; do not refer to or reuse any other call's result. Issue exactly two ordered searches:

1. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} budget mid-range luxury entertainment per person per day`
2. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} sightseeing activities entertainment entrance tickets per person per day`

Do not read pages, retry, use fallbacks, calculate, convert currency, or use another city. Return JSON only using
schema `city-cost-v5-activity-repeatability-v1`. Accept only exact-city USD Budget/Mid-Range/Luxury entertainment
rows explicitly priced per person per day; preserve truthful `not_found` or `blocked` for missing rows. Do not double
values in the response. Include the standard telemetry object and exact search queries.
