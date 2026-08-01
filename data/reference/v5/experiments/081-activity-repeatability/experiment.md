# Experiment 081 — activity one-call repeatability panel

**Status:** Complete - repeatability gate rejected for sparse-city coverage

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

## Results

All 15 calls were protocol-compliant. Mumbai, Dubai, Paris, and Copenhagen each returned complete, identical tier
values in all three calls (0% within-city relative range). Fukuoka returned `not_found` in all three calls because
search results were nearby or country-level rather than an exact-city source. Thus four of five cities had complete
repeatability, but the pre-registered five-city gate failed. The route is repeatable for ordinary covered cities and
must fail closed for sparse cities; no cross-call averaging or product mapping is authorized.
