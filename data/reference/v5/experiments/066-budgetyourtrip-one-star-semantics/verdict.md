# Experiment 066 verdict - BudgetYourTrip one-star occupancy remains undefined

## Decision

Reject the BudgetYourTrip route as a direct one-star product source. Twelve single-city Luna contexts
performed exactly one BudgetYourTrip search and one exact-city page read each. The deterministic audit found **0/12
strict semantic rows**: eight pages exposed numeric one-star statistics but did not explicitly define two-person
occupancy, and four page reads were blocked or timed out. The promotion gate required 8/12 strict rows.

The numeric values are retained as unvalidated proxy candidates. They must not be treated as observed two-adult
prices, used as ground truth for a one-star ratio, or silently promoted from `unknown_source_default` to the frozen
`accom_1_star` estimand. Blocked pages remain `blocked`, not missing or class-absent. A source-level
`source_defined_double_occupancy` convention may be tested separately; if used, it requires independent explicit-
two-adult calibration and final values must be labelled `modelled`.

See `results.json`, `audit.json`, and the per-city telemetry files for the fixed one-search/one-read protocol.
