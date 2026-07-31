# Experiment 022 — verdict

**Verdict: promote the bounded city-identity cascade as a food/drink source-route revision, but retain sparse and partial failures.**

Six independent one-city calls used the frozen two-step route: an exact canonical-slug query for each measure, followed only when needed by one city+country-qualified identity query. The route returned 21/30 cells (70%) and four complete cities. Lisbon and San Francisco were 5/5 without identity searches; Hanoi recovered its mid-range meal with one identity query; Helsinki recovered beer; Kyoto recovered beer but remained 1/5; Don Det remained 0/5 after ten searches.

The six calls issued 30 canonical and 11 identity queries (41 total), 12 search operations, and no direct reads, third queries, retries, fallback sources, arithmetic, FX, or cross-city evidence. All 21 accepted facts contained exact city, row, central value, currency, and canonical URL evidence. Identity searches recovered three facts, including two previously missed edge-case facts, but consumed extra search budget and did not solve sparse Don Det.

Promote the cascade for ordinary food/drink cities with a fixed maximum of two identity queries per measure, dedicated-query provenance, and fail-closed missingness. Do not use country averages or nearest-city substitutions. This remains source-feasibility evidence, not independent price accuracy or complete 19-field validation.
