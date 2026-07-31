# Experiment 028 — verdict

**Verdict: promote Expedia 2–4-star trend snippets as a candidate source route; reject complete accommodation
acceptance and mark the protocol deviation.**

Lisbon, Hanoi, and Copenhagen were each tested in a one-city invocation. The first two calls issued exactly
four Expedia-restricted searches; Copenhagen repeated the identical batch, producing eight actual search
operations for four unique queries. That duplicate is recorded and the Copenhagen invocation is not counted as
production-compliant. Across first unique batches, 7/12 cells were accepted: Lisbon 2/3/4-star, Hanoi
2/3/4-star, and Copenhagen 3-star. No 1-star row was found and no city was complete.

Accepted snippets explicitly state city/class, a next-month or monthly trend, a nightly two-adult base-rate
window, and taxes/fees excluded. USD is normalized from Expedia.com dollar display and remains a source-locale
inference requiring deterministic currency review. These rows are retrieval-feasibility evidence, not
independent ground truth or fitted coefficients.

Retain the 2–4-star Expedia route for a larger one-city panel and separately solve 1-star coverage. Do not
silently use `from`/lowest values, weekend-only prices, or the duplicate-search run as evidence of one-call
compliance. Require 30 complete cities and 10 locked holdout cities before promoting any accommodation model.
