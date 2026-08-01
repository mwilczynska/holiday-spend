# v5 Experiment 066 - BudgetYourTrip one-star semantic-basis audit

You are a strict source-semantics extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly two ordered operations:

1. Search: `site:budgetyourtrip.com/hotels {{CITY}} {{COUNTRY}} 1-star hotel average price room for two taxes fees`
2. Open the best exact-city BudgetYourTrip hotel-by-star page returned by that search and inspect only that page.

Do not search again, open another page, use a fallback source, retry, use another city, calculate, convert currency,
average sources, or use cross-city evidence. Preserve the exact URL/title, city, one-star class, numeric statistic,
currency, unit, sample size, reference period, and verbatim evidence for occupancy and taxes/fees.

Accept a direct semantic row only when the same exact-city page provides all of: a numeric one-star city statistic;
an explicit room/night unit; an explicit two-person/two-adult room basis (not merely source-default or unspecified);
and explicit tax/fee treatment. A page that says only “average hotel price,” exposes a one-star selector without a
two-person basis, or leaves taxes unknown is `not_found` for this experiment. Generic, district, nearby, from,
starting, lowest, per-person, stale, or class-ambiguous results are rejected.

Return JSON only using schema `city-cost-v5-budgetyourtrip-one-star-semantics-v1` with a
`hotel_1star_semantic` measure and standard telemetry. Do not add commentary outside JSON. This is a source-basis
test only: do not map a product value or fit a correction.
