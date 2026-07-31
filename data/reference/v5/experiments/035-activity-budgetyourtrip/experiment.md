# Experiment 035 — Budget Your Trip activity spend

Date: 2026-07-31

## Hypothesis

Budget Your Trip's city pages may expose explicit per-person daily sightseeing/entertainment values and
budget/mid/luxury activity rows, providing a more reproducible activity anchor than individual attraction search.

## Production-shaped test

Each Luna invocation researches exactly one city and issues exactly two BudgetYourTrip-restricted searches. This
tranche tests Lisbon, Hanoi, and Copenhagen independently. No reads, retries, arithmetic, FX conversion, averaging,
or cross-city evidence are allowed. `activities_free = 0` remains definitional.

## Acceptance

Accept only exact-city activity/entertainment evidence with explicit unit, party basis, tier label, scope, value,
and date. Source rows are not product values until deterministic two-person scaling and tier semantics are
validated. Do not substitute total trip budget or an individual tour price.
