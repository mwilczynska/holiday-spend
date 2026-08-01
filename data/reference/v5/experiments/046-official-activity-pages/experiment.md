# Experiment 046 — official activity pages

## Hypothesis

Official attraction, authority, museum, and named-operator pages expose definition-compatible activity prices more
reliably than marketplace and aggregator snippets, particularly for standard tickets.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities: Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York City.
- Exactly three ordered official-source searches per call: attraction ticket, half-day group, full-day premium.
- No page reads, retries, marketplace fallbacks, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Promote a measure to a broader panel if at least 3/6 cities pass its strict contract.
- Any accepted row remains a one-person source input; no product mapping or model fitting follows this feasibility
  test. A later mapping requires the 30-city/10-holdout validation gate.

## Results

The six-city panel produced **0/18 strict compatible cells**: budget 0/6, mid-range 0/6, and high-end 0/6. Each
city used exactly three ordered official-source searches (18 total), with no reads, retries, marketplace fallback,
arithmetic, FX conversion, averaging, or cross-city evidence. Two budget tickets (Bangkok and Cape Town) were
otherwise compatible but had unknown tax treatment; the remaining rows failed on tax, adult/party basis, duration,
premium status, or numeric price.

**Verdict:** reject the official-page route as a complete production activity source under the frozen contract.
Retain the two unknown-tax budget tickets as rejected evidence only. Do not map or fit any activity tier from this
panel; a future tax-resolved budget-only test would require a new pre-registered experiment.
