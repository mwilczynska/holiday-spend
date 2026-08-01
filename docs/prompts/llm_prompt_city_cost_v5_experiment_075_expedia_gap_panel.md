# v5 Experiment 075 prompt — targeted Expedia class-gap panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Use search only and issue exactly three ordered Expedia-restricted searches:

1. `site:expedia.com {{CITY}} {{COUNTRY}} 2-star hotels average nightly price trend 2 adults taxes fees`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotels average nightly price trend 2 adults taxes fees`
3. `site:expedia.com {{CITY}} {{COUNTRY}} 4-star hotels average nightly price trend 2 adults taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source, or
use cross-city evidence. Preserve exact city/class, source URL/title, occupancy wording, price statistic, reference
window, currency, and tax/fee evidence.

Accept only the strict Expedia class-trend contract: exact city and requested class, numeric non-`from` nightly
average/trend for two adults, named currency and reference window, and explicit tax treatment. An explicit base-rate
statement excluding taxes/fees is `taxStatus: excluded`, never included. Reject district/nearby cities, generic
all-hotel trends, from/starting/lowest prices, single-property quotes, weekend/event-only values, ranges,
per-person prices, stale/malformed currencies, and class-ambiguous results.

Return JSON using schema `city-cost-v5-expedia-paired-panel-v1` with `hotel_2star_room_2p`,
`hotel_3star_room_2p`, and `hotel_4star_room_2p` measures plus the standard telemetry object. Do not add commentary.
Found rows remain source evidence only and cannot be fitted until the pooled 30-city matched relationship and ten
locked holdouts pass.
