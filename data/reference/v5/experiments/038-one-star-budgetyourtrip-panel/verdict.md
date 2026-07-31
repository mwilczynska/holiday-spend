# Experiment 038 — verdict

**Verdict: promote BudgetYourTrip as a guarded one-star fallback candidate; reject it as an observed product
anchor or fitted correction.**

Twenty independent one-city Luna calls each issued exactly one BudgetYourTrip-restricted search. All 20 searches
and operations were protocol-compliant with no reads, retries, fallback sources, arithmetic, FX conversion, or
cross-city evidence. Strict coverage was **17/20**: Buenos Aires had no exact-city row, Taipei exposed only a
zero-denominator value, and Paris was blocked by a truncated web response that correctly did not trigger a retry.

All 17 accepted rows had unknown or source-default occupancy, so explicit two-adult coverage was zero. Manila
(n=2) and Mumbai (n=3) are tiny-sample warnings. Across the wider Experiments 034/038 source set, several cities
also expose materially different values on different BudgetYourTrip page families; those alternatives were
rejected rather than averaged.

Retain the route only as a guarded imputation/fallback candidate with exact-city identity, zero-denominator and
minimum-sample checks, page-family selection, provenance, and uncertainty. Do not present it as observed
two-adult `accom_1_star`, fit a correction, or count source coverage as target accuracy.
