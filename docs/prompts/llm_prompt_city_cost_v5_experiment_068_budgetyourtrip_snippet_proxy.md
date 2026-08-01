# v5 Experiment 068 - BudgetYourTrip search-snippet occupancy proxy

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly two ordered searches:

1. `site:budgetyourtrip.com/hotels {{CITY}} {{COUNTRY}} 1-star hotel average price one night before taxes`
2. `site:budgetyourtrip.com {{CITY}} {{COUNTRY}} "two people" "double-occupancy" hotel price`

Do not open pages, search again, retry, use a fallback source, use another city, calculate, convert currency,
average sources, or use cross-city evidence. Preserve each result URL/title, exact city, one-star class, numeric
statistic, currency, unit, sample size, reference wording, tax evidence, and the source-level two-person wording.

Accept `proxy_candidate` only when the two search result snippets independently provide: an exact-city one-star
numeric one-night statistic with named currency and explicit tax basis; and a same-source exact-city statement about
two people or a typical double-occupancy hotel room. Search snippets are weaker than page evidence, so this remains a
proxy candidate, never an observed two-adult product value. Blocked or empty search results, wrong cities, stale or
class-ambiguous snippets, and unknown tax remain non-candidates.

Return JSON only using schema `city-cost-v5-budgetyourtrip-snippet-proxy-v1` with `hotel_1star_proxy` and
`double_occupancy_semantics` measures plus standard telemetry. Do not add commentary outside JSON. No mapping,
fitting, tax normalization, or product output is authorized.
