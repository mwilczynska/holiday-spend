# v5 Experiment 084 prompt — Nomadlio food/drink proxy panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Issue exactly two ordered web operations, with no retries, fallback source, arithmetic, currency conversion, or
cross-city evidence:

1. Search: `site:nomadlio.com/{{SLUG}}/cost-of-living/ Nomadlio {{CITY}} cost of living`
2. Read the exact Nomadlio city page returned by search 1.

From that exact page, record the numeric USD display values for the labels `Inexpensive Meal`, `Mid-Range Meal`,
`Coffee`, `Beer` under Restaurants & Dining, and `Cocktail`; also record `Wine Bottle` under Groceries when present.
Do not call a row product-compatible unless the page itself states serving size, party size, tax/fee treatment, and a
clear statistic. If those definitions are absent, preserve the row as `source_defined_proxy` with `definitionStatus`
`unit_or_party_unspecified`; never infer per-person, two-person, cappuccino, wine-by-glass, street-food, or premium-meal
semantics. Reject wrong/nearby cities, ranges, missing values, and stale pages without an update date. Preserve exact
page URL/title, retrieval date, update date, label, currency, value, and evidence text.

Return schema `city-cost-v5-nomadlio-food-drink-v1` with measures `inexpensive_meal`, `mid_range_meal`, `coffee`,
`beer`, `cocktail`, and `wine_bottle`, plus standard telemetry. These are source/proxy observations only; do not
calculate product tiers or perform arithmetic.
