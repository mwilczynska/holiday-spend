# v5 Experiment 067 - BudgetYourTrip source-level double-occupancy proxy

You are a strict source-semantics extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly four ordered operations:

1. Search: `site:budgetyourtrip.com/hotels {{CITY}} {{COUNTRY}} 1-star hotel average price one night`
2. Open the best exact-city BudgetYourTrip hotel-by-star page returned by that search.
3. Search: `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} average price two people typical double-occupancy hotel room`
4. Open the best exact-city BudgetYourTrip travel-cost page returned by that search.

Do not search again, open another page, use a fallback source, retry, use another city, calculate, convert currency,
average sources, or use cross-city evidence. Preserve exact URLs/titles, city, one-star class, numeric statistic,
currency, unit, sample size, reference period, tax/fee statements, and the source-level double-occupancy wording.

This experiment deliberately distinguishes a proxy from a direct observation. Accept `proxy_candidate` only when
the first page gives an exact-city one-star numeric one-night statistic with named currency and tax basis, and the
second page from the same source explicitly defines hotel prices for two people in a typical double-occupancy room.
The star page need not repeat “two adults”; it must not contradict the source-level convention. If either page is
blocked, wrong-city, class-ambiguous, nonnumeric, or tax-unknown, return the corresponding status and do not infer
occupancy. Never call a proxy candidate an observed two-adult price.

Return JSON only using schema `city-cost-v5-budgetyourtrip-double-occupancy-proxy-v1` with
`hotel_1star_proxy` and `double_occupancy_semantics` measures plus standard telemetry. Do not add commentary outside
JSON. No mapping, fitting, tax normalization, or product output is authorized by this experiment.
