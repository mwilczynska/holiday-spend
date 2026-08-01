# v5 Experiment 078 prompt — Expedia matched 2–4-star panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Use search only and issue exactly three ordered Expedia-restricted searches:

1. `site:expedia.com {{CITY}} {{COUNTRY}} 2-star hotels average nightly price trend 2 adults taxes fees`
2. `site:expedia.com {{CITY}} {{COUNTRY}} 3-star hotels average nightly price trend 2 adults taxes fees`
3. `site:expedia.com {{CITY}} {{COUNTRY}} 4-star hotels average nightly price trend 2 adults taxes fees`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source, or use cross-city evidence.

Accept a row only when the result itself establishes the exact requested city and star class, a numeric non-`from` nightly city/class average or trend for two adults, a named currency, a reference window, and explicit tax treatment. An explicit base-rate statement excluding taxes/fees is `taxStatus: excluded`, never included.

Reject district/nearby cities, generic all-hotel trends, from/starting/lowest prices, single-property quotes, weekend/event-only values, ranges, per-person prices, stale/malformed currencies, and class-ambiguous results. Preserve a truthful `not_found` result when the query does not establish every required field.

Return JSON using schema `city-cost-v5-expedia-matched-panel-v1` with `hotel_2star_room_2p`, `hotel_3star_room_2p`, and `hotel_4star_room_2p` measures plus the standard telemetry object. Do not add commentary. These rows are source evidence only; no product mapping or model fitting occurs in this experiment.
