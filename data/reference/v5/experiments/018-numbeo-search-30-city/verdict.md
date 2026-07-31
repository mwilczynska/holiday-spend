# Experiment 018 — verdict

**Verdict: promote the Numbeo search-snippet route as a food/drink anchor candidate, but reject it as the complete production methodology.**

Thirty independent one-city GPT-5.6 Luna-class invocations used the unchanged Experiment 016 prompt and source policy. The development split returned 100/100 cells and 20/20 complete cities. The locked holdout returned 44/50 cells (88%): Amsterdam, Paris, Sydney, Melbourne, New York City, Marrakech, Cape Town, and Bogotá were complete; Helsinki was 4/5 with beer not found; Kyoto was 0/5 because every query returned only comparison or other-city pages. Overall coverage was 144/150 cells (96%) and 28/30 complete cities (93.3%). The failures were retained as missing outcomes rather than filled from nearby cities.

Across all 30 calls there were 150 restricted queries and 60 search operations, with zero direct page reads, fallback sources, arithmetic, or cross-city evidence. Every accepted record contained exact city, row, central value, currency, and canonical URL evidence in the search response. Five Nha Trang cells used an explicit `displayCurrency=USD` URL and several symbol-to-ISO mappings were context-resolved; these provenance-basis items require deterministic review before production. Direct page verification was intentionally not part of this route.

Compared with retained definition- and currency-compatible observations, 139 rows across 28 cities had median absolute error 0%, p90 7.14%, and maximum 16.88%. The locked holdout's 44 rows had median absolute error 0.54%, p90 7.22%, and maximum 16.67%. These are retrieval/date-drift audits, not evidence that the final 19-tier models are accurate.

Promote this route for continued food/drink source validation and for testing a deterministic source-currency normalizer. Do not accept the complete pipeline: the holdout city-completion rate is 80% and overall complete-city one-call success is 93.3%, below the 95% gate; provider telemetry is also unavailable. Keep Helsinki beer and Kyoto's five cells as explicit `not_found`. Accommodation, activities, and all 19-field derivations remain open.
