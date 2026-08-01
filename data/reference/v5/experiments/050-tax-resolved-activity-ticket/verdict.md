# Experiment 050 verdict — reject tax-resolved ticket promotion gate

## Decision

The tax-resolved official-ticket route does not pass its 4/6 promotion gate. Retain Bangkok and Lisbon as direct
one-person source candidates, but do not treat the route as production-complete or map it to `activities_budget`.

## Evidence

- Six independent single-city Luna-class contexts: Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York City.
- Exactly one ordered search per city (6 total); no reads, retries, fallbacks, arithmetic, FX, or cross-city evidence.
- Strict accepted tickets: **2/6** — SeaLife Bangkok (THB290, taxes/fees included) and Oceanário de Lisboa (EUR25,
  VAT included).
- Four cities failed on unknown tax, from/starting prices, absent numeric adult price, or incompatible bundles.

This is useful evidence that direct budget-ticket extraction can work for some cities, but not sufficient for the
one-call production contract or 30-city/10-holdout model validation.
