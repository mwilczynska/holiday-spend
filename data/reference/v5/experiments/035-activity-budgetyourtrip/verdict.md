# Experiment 035 — verdict

**Verdict: promote Budget Your Trip activity extraction to a broader source-validation panel; reject product
mapping until scaling and semantics are validated.**

Lisbon, Hanoi, and Copenhagen each received one compliant single-city Luna call with exactly two restricted
searches. All 12/12 measures passed: an exact-city per-person daily activity average plus budget, mid-range, and
luxury entertainment rows. Every row explicitly used one-person/day basis; no calls used reads, retries,
fallbacks, arithmetic, FX conversion, averaging, or cross-city evidence.

This is a materially better source shape than individual attraction searches. `activities_free = 0` remains
definitional. The activity average equals the mid-range row in all three cities, so the relationship is recorded as
source behaviour, not fitted. Deterministic two-person scaling and the mapping from entertainment tiers to product
tiers still require independent validation; no product value is promoted from this tranche.
