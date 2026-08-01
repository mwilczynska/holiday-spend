# v5 Experiment 063 - Expedia paired 2-/3-/4-star panel, tranche 2

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three ordered Expedia-restricted searches:

1. `site:expedia.com {{CITY}} {{COUNTRY}} 2-star hotels average nightly price trend 2 adults taxes fees`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotels average nightly price trend 2 adults taxes fees`
3. `site:expedia.com {{CITY}} {{COUNTRY}} 4-star hotels average nightly price trend 2 adults taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source,
or use cross-city evidence. Preserve exact city/class, source URL/title, occupancy wording, price statistic,
reference window, currency, and tax/fee evidence. This is a new-city paired collection only; do not map a product
tier or fit a ratio.

Accept only the same strict Expedia contract as the prior paired panels: exact city and requested class, numeric
non-from nightly average/trend for two adults, named currency and reference window, and explicit tax treatment.
An explicit base-rate statement excluding taxes/fees is `taxStatus: excluded`, never included. Reject district/nearby
cities, generic all-hotel trends, from/starting/lowest prices, single-property quotes, weekend/event-only values,
ranges, per-person prices, stale/malformed currencies, and class-ambiguous results.

Return JSON only using schema `city-cost-v5-expedia-paired-panel-v1` with `hotel_2star_room_2p`,
`hotel_3star_room_2p`, and `hotel_4star_room_2p` measures and the standard telemetry object. Do not add commentary
outside JSON. Found rows remain source evidence only and cannot be fitted until 30 complete matched cities and ten
locked holdouts pass.
