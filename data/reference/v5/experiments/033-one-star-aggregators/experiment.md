# Experiment 033 — one-star aggregator sources

Date: 2026-07-31

## Hypothesis

Trip.com, HotelsCombined, or Budget Your Trip may expose city-wide 1-star averages more reliably than booking
source class pages. These rows may be usable as candidate predictors, but occupancy and product accuracy must be
validated separately.

## Production-shaped test

Each Luna invocation researches exactly one city and issues exactly three restricted searches. This tranche tests
Lisbon, Barcelona, and Hanoi independently. No reads, retries, fallback, arithmetic, FX conversion, averaging,
or cross-city evidence are allowed.

## Acceptance

Accept only exact city/class/date-aware numeric city-wide 1-star statistics. Preserve source-default or unknown
occupancy as a non-product evidence basis. This tranche measures retrieval only; no value is mapped to
`accom_1_star` and no model is fitted.
