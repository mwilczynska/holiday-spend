# Experiment 082 — World Stay Tracker explicit 3-/4-star accommodation panel

**Status:** Complete — reject promotion

## Question

Can World Stay Tracker provide exact-city, star-specific daily hotel averages with explicit two-adult/one-night
occupancy in one bounded production-shaped call, at coverage high enough to become the next accommodation anchor?

## Hypothesis

The documented World Stay Tracker city pages will produce strict 3-star and 4-star rows for at least 10/12 cities and
10/12 protocol-compliant calls. The source's breakfast inclusion and popular-property selection will remain explicit;
this experiment will not silently treat those rows as room-only ground truth. **Rejected:** the panel produced 0/12
complete 3-/4-star city rows, although all 12 calls were protocol-compliant; only five rows passed the canonical strict
schema, all 3-star, and no 4-star row passed.

## Pre-registered protocol

- One independent GPT-5.6 Luna-class context per city.
- Exactly four ordered operations: search/read for 3-star, then search/read for 4-star.
- No retries, fallback source, arithmetic, FX conversion, or cross-city evidence.
- Accept only exact-city pages with numeric USD average, selected rating, dates/window, property count, and explicit
  2-adult/1-night/breakfast/review-score basis.
- A screen pass authorizes a separate 30-city semantic/accuracy calibration against independent room-only observations;
  it does not authorize product mapping or breakfast removal.
