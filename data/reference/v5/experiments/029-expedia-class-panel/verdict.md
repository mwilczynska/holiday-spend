# Experiment 029 — verdict

**Verdict: promote Expedia 2–4-star trend extraction for broader validation; reject complete accommodation
coverage.**

Bangkok, San Francisco, and Nairobi each received one compliant four-query Expedia invocation (12 searches,
12 search operations; no reads, retries, fallback, arithmetic, FX, or cross-city evidence). The tranche accepted
8/12 cells: Bangkok 2/3/4-star, San Francisco 2/3/4-star, and Nairobi 3/4-star. No 1-star row was found in
any city; Nairobi 2-star was also missing. No city was complete.

Together with Experiment 028, this supports a promising but incomplete 2–4-star route across six cities. It
does not prove accuracy or supply 1-star ground truth. Continue with a separately declared 1-star source test;
do not infer 1-star from 2-star or call source coverage complete. Require a locked 30-city/10-holdout panel
before fitting or promoting an accommodation model.
