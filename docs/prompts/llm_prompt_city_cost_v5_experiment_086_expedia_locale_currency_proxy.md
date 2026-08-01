# v5 Experiment 086 prompt — Expedia.com bare-dollar currency proxy

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Use search only and issue exactly these three ordered Expedia-restricted searches:

1. `site:expedia.com "{{CITY}}" "Price trends for properties with 2 Stars" "2 adults" "taxes and fees"`
2. `site:expedia.com "{{CITY}}" "Price trends for properties with 3 Stars" "2 adults" "taxes and fees"`
3. `site:expedia.com "{{CITY}}" "Price trends for properties with 4 Stars" "2 adults" "taxes and fees"`

Do not open pages, retry, use another city, calculate, convert currency, average sources, use a fallback source,
or use cross-city evidence. Do not call a bare `$` USD. Preserve the symbol and its uncertainty.

For each exact city/class result, accept a `found_proxy` measure if it establishes a numeric non-`from` nightly
city/class trend, explicit two-adult basis, reference window, tax treatment, and a URL whose host is exactly
`www.expedia.com`, even when the currency is shown only as `$`. Set `currency: null`, `currencyStatus: bare_dollar`,
and `currencyBasis: source_locale_candidate`. If a named currency code is explicitly present, use
`status: found_observed` and preserve it. Reject generic all-hotel, district/nearby, wrong-city, class-ambiguous,
from/starting/lowest, per-person, weekend/event-only, missing-value, and blocked results.

Return JSON using schema `city-cost-v5-expedia-locale-currency-proxy-v1` with `hotel_2star_room_2p`,
`hotel_3star_room_2p`, and `hotel_4star_room_2p` measures plus standard telemetry. No USD mapping, arithmetic,
FX conversion, product mapping, or model fitting occurs in this response.
