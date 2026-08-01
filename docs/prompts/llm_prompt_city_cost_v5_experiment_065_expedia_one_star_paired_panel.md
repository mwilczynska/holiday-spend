# v5 Experiment 065 - Expedia one-star/three-star paired panel

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly two ordered Expedia-restricted searches:

1. `site:expedia.com {{CITY}} {{COUNTRY}} 1-star hotels average nightly price trend 2 adults taxes fees`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotels average nightly price trend 2 adults taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source,
or use cross-city evidence. Preserve exact city/class, source URL/title, occupancy wording, price statistic,
reference window, currency, and tax/fee evidence. This is a new one-star source-boundary panel; do not map a
product tier or fit a ratio.

Accept only this strict contract for each class: exact city and requested class, numeric non-from nightly
average/trend for two adults in one room, named currency and reference window, and explicit tax treatment. An
explicit base-rate statement excluding taxes/fees is `taxStatus: excluded`, never included. The 1-star row must
explicitly identify the one-star class; a generic budget/economy result is not sufficient.

Reject district/nearby cities, generic all-hotel trends, from/starting/lowest prices, single-property quotes,
weekend/event-only values, ranges, per-person prices, stale/malformed currencies, class-ambiguous results, and
selector-only or maximum-occupancy facts without a numeric price.

Return JSON only using schema `city-cost-v5-expedia-one-star-paired-panel-v1` with
`hotel_1star_room_2p` and `hotel_3star_room_2p` measures and the standard telemetry object. Do not add commentary
outside JSON. Found rows remain source evidence only and cannot be fitted or mapped until the pre-registered
30-city/10-holdout validation requirements pass.
