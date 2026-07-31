# v5 Experiment 038 — single-city one-star BudgetYourTrip panel

Research **one city only**: `{{CITY}}, {{COUNTRY}}`. Issue exactly one search restricted to BudgetYourTrip.com
for an exact city-wide 1-star hotel price statistic. Search only; do not open pages, retry, calculate, convert
currency, use another city, or map the result.

Accept a row only when the evidence identifies the exact city and 1-star class, gives a numeric non-`from`
nightly statistic, named currency, source URL/title, reference date/window, and any visible hotel count. Record
occupancy as `explicit_two_adults`, `source_default_room`, or `unknown`; never upgrade source-default/unknown.
Reject generic hotel averages, properties, ranges/from prices, city-name mismatches, zero-denominator tables, and
unsupported quality artifacts. A one-hotel result remains a quality warning even if numeric.

Return JSON only using schema `city-cost-v5-one-star-aggregator-v1` and measure
`budgetyourtrip_one_star_average` with `status`, `value`, `currency`, `unit: per_room_per_night`,
`occupancyBasis`, `class: 1_star`, `referencePeriod`, `sourceUrl`, `sourceTitle`, `evidenceText`, `searchQuery`,
`sampleSize` when visible, and `reason`; telemetry must show exactly one search and zero reads/retries/fallback/
arithmetic/FX/cross-city evidence. This is a calibration/source panel, not an observed two-adult product value.
