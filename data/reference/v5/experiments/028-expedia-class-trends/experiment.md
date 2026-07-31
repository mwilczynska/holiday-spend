# Experiment 028 — Expedia class-trend feasibility

Date: 2026-07-31

## Hypothesis

Expedia's public price-trend snippets may supply two-adult, class-specific nightly averages with a reference
window, overcoming the missing occupancy in the earlier heterogeneous class-average search results.

## Production-shaped test

Each Luna-class invocation researches exactly one city and issues exactly four Expedia-restricted searches,
one for each star class. Three independent calls test Lisbon (Portugal), Hanoi (Vietnam), and Copenhagen
(Denmark). No direct reads, retries, fallback sources, arithmetic, FX conversion, or cross-city evidence are
allowed.

## Acceptance

Retain only exact city/class/two-adult/average-or-trend/date-window rows with a numeric non-`from` value.
This is retrieval feasibility evidence, not ground truth or fitted accommodation validation. Require 30
complete cities and 10 locked holdout cities before any class model is promoted.
