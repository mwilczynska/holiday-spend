# Experiment 081 — activity one-call repeatability panel

**Status:** In progress

## Question

Does the single-city, two-search BudgetYourTrip activity extraction repeat on difficult, sparse, and high-cost cities
without using retries, cross-call results, or arithmetic?

## Pre-registered protocol

- Five cities, three independent calls per city; each call has its own context.
- Exactly two ordered BudgetYourTrip-restricted searches per call, no page reads, retries, fallback, arithmetic, FX, or
  cross-city evidence.
- Strict rows use the Experiment 080 exact-city USD per-person/day contract. Missingness is retained.
- A repeatability pass requires 15/15 protocol-compliant calls, all five cities with three complete tier sets, and a
  median within-city relative range no greater than 25% for each tier. Results are dispersion diagnostics, not ground
  truth or a product accuracy claim.
