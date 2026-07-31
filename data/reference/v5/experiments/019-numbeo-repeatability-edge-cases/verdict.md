# Experiment 019 — verdict

**Verdict: repeatability is mixed; retain the Numbeo route only as a bounded food/drink candidate and reject any claim of complete reliable coverage.**

Fifteen fresh, independent one-city calls used the unchanged Experiment 016 prompt. Kyoto and Don Det were stable no-result failures: all three repeats for each city were 0/5, with only comparison or unrelated locations rejected. Nha Trang returned the same five USD-rendered values in all three repeats; each run also exposed a native VND alternative that was explicitly rejected to avoid mixing bases. Beijing returned the same five values in CNY across all three repeats, with the `¥` symbol mapped from the explicit city/country context and no conversion.

Helsinki exposed a provenance-sensitive failure. Repeat 1 followed the broad Experiment 018 policy and counted 5/5 because a canonical snippet containing beer appeared in another query batch, although the dedicated beer query itself returned unrelated pages. Repeats 2 and 3 enforced dedicated-query provenance and returned 3/5 and 4/5, respectively; inexpensive meal, McMeal, and cappuccino were stable, mid-range appeared once under strict provenance, and beer was never dedicated-query found. Broad same-call coverage was 42/75 cells (56%); normalizing Helsinki's non-dedicated beer to `not_found` gives 41/75 (54.7%).

The 15 calls issued 75 searches and 36 search operations, with zero direct reads, retries, fallback sources, arithmetic, or cross-city evidence. Exact provider model ID, parameters, tokens, latency, and cost were not exposed. The result demonstrates why query-to-fact provenance must be explicit: aggregating a row merely because it appeared somewhere in the same web-search batch can overstate coverage.

**Decision:** keep the search route for ordinary food/drink cities only with dedicated-query provenance, native-currency validation, and fail-closed missingness. Do not retry or average away Kyoto/Don Det failures. Accommodation, activities, complete 19-field derivation, and provider telemetry remain unresolved.
