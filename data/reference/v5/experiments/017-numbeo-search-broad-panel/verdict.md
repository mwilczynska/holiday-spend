# Experiment 017 — verdict

**Verdict: promote the Numbeo search-snippet route for broader validation, but reject it as a complete city methodology.**

Six independent GPT-5.6 Luna-class invocations each handled one city. Five Numbeo-restricted searches were issued per invocation. Lisbon, Hanoi, Bangkok, San Francisco, and Nairobi returned all five exact food/drink facts (25/25); sparse Don Det returned 0/5 because search results were unrelated similarly prefixed locations. Overall coverage was 25/30 cells (83.3%) and 5/6 complete cities (83.3%). No direct page reads, fallback sources, arithmetic, or cross-city substitutions were used. The failure is retained as an explicit sparse-city outcome rather than imputed.

The 25 accepted facts all satisfied the extraction contract: exact city identity, exact row label, central value, source currency, and canonical Numbeo URL. This is a contract/citation audit, not an independent page-read audit, because the experiment deliberately prohibited direct page retrieval. Eleven provider-search operations served 30 queries. The delegated execution surface did not expose exact provider model ID, parameters, tokens, latency, or cost; those remain acceptance gaps rather than inferred values.

Ten definition-compatible rows (Lisbon and Hanoi) could be compared with retained direct observations. Absolute errors had median 0%, p90 9.09%, and maximum 10.0%. This small, date-drifting comparison is a source audit only; it is not the required 30-city locked validation and does not establish model accuracy.

Promote the search-only Numbeo route as a food/drink anchor candidate for a larger city-level validation. Keep the canonical URL and exact-row checks, five-query budget, and fail-closed `not_found` result. Do not use nearby-city data for Don Det without a separately validated sparse-city fallback. Accommodation, activities, exact production telemetry, and complete 19-field coverage remain unresolved.
