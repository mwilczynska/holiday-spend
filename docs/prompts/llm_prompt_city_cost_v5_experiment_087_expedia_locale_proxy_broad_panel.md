# v5 Experiment 087 prompt — Expedia.com locale-proxy broad panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Issue exactly these three ordered Expedia-restricted searches, and use search only:

1. `site:expedia.com "{{CITY}}" "Price trends for properties with 2 Stars" "2 adults" "taxes and fees"`
2. `site:expedia.com "{{CITY}}" "Price trends for properties with 3 Stars" "2 adults" "taxes and fees"`
3. `site:expedia.com "{{CITY}}" "Price trends for properties with 4 Stars" "2 adults" "taxes and fees"`

Do not open pages, retry, use a fallback source, use another city, calculate, convert currency, average sources,
or use cross-city evidence. Do not call a bare `$` USD.

For each result, record a `found_proxy` row when it establishes exact city and class, a numeric non-`from` nightly
trend, explicit two-adult basis, reference window, tax treatment, and a URL whose host is exactly `www.expedia.com`,
even if the symbol is only `$`. Use `currency: null`, `currencyStatus: bare_dollar`, and
`currencyBasis: source_locale_candidate`. A named currency may be `found_observed`. Reject generic city trends,
district/nearby/wrong-city pages, class ambiguity, from/starting/lowest prices, per-person or event-only values,
unknown tax, and blocked results. Preserve truthful `not_found`/`blocked` outcomes.

Return JSON schema `city-cost-v5-expedia-locale-proxy-broad-v1` with measures
`hotel_2star_room_2p`, `hotel_3star_room_2p`, `hotel_4star_room_2p` and standard telemetry. No USD mapping,
arithmetic, FX, product mapping, or model fitting occurs in this response.
