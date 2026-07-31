# Experiment 037 — definition-matched activity anchors

Date: 2026-07-31

## Hypothesis

BudgetYourTrip's named activity examples can supply the frozen activity estimands more faithfully than its generic
entertainment tiers: a low-cost paid attraction, a duration-labelled half-day group activity, and a duration/
premium-labelled full-day activity.

## Production-shaped test

Each Luna invocation researches exactly one city and issues exactly three BudgetYourTrip-restricted searches. This
tranche tests Lisbon, Hanoi, and Copenhagen independently. No reads, retries, fallback, arithmetic, FX conversion,
averaging, or cross-city evidence are allowed.

## Acceptance

Require exact city, numeric non-from price, source/date identity, party basis, and the duration/class criteria for
each anchor. Generic entertainment averages are rejected. This is source/ground-truth feasibility only; no product
mapping or model fit is accepted from three cities.
