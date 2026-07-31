# v5 Experiment 034 — single-city one-star aggregator panel prompt

Use the same strict contract as Experiment 033. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly three searches: one each restricted to Trip.com, HotelsCombined, and Budget Your Trip. Search only;
do not open pages, retry, calculate, convert currency, average sources, or use another city.

Accept only an exact city-wide 1-star nightly statistic with numeric non-`from` value, named currency, source
URL/title, and reference date/window. Preserve `explicit_two_adults`, `source_default_room`, or `unknown`
occupancy exactly. Reject properties, ranges, lowest/from prices, generic hotel averages, district/regional
results, and inferred classes. Return JSON using schema
`city-cost-v5-one-star-aggregator-v1` with measures `trip_one_star_average`,
`hotelscombined_one_star_average`, and `budgetyourtrip_one_star_average`, plus exact telemetry showing three
searches and no reads/retries/fallback/arithmetic/FX/cross-city evidence.

This is a source-agreement panel. Do not map any row to the two-adult `accom_1_star` estimand, fit a correction,
or calculate a cross-source summary in the model. The pre-registered panel is city-level: development cities are
Copenhagen, Prague, Bangkok, Mexico City, Tokyo, Cape Town, and Nairobi; locked holdouts are San Francisco,
Helsinki, and New York. The panel may be rejected for coverage, source disagreement, quality warnings, or
occupancy incompatibility.
