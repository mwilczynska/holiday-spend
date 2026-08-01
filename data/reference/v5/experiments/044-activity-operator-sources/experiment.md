# Experiment 044 — operator-source activity definitions

## Hypothesis

Operator marketplaces expose definition-compatible ticket, half-day, and full-day activity prices more often
than the generic BudgetYourTrip entertainment route, while preserving duration and party semantics in snippets.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities across regions and cost bands: Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York City.
- Exactly three ordered searches per call: GetYourGuide ticket, Viator half-day group, GetYourGuide full-day premium.
- No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Promote a source/measure route to a broader panel if at least 3/6 cities pass that measure's strict contract.
- A source route may be promoted for one measure and rejected for another; do not silently substitute generic
  entertainment rows.
- Any accepted row remains a one-person source input. A future product mapping requires deterministic scaling and
  independent 30-city/10-holdout accuracy validation.

## Results

The six-city panel produced **0/18 accepted cells**: budget 0/6, mid-range 0/6, and high-end 0/6. Each city used
exactly three ordered operator searches (18 total), with no page reads, retries, fallback sources, arithmetic, FX,
averaging, or cross-city evidence. “From”/lowest prices and variable group pricing were the dominant failures;
other rows lacked a standalone ticket, tax status, compatible duration, or explicit adult/premium basis.

**Verdict:** reject the tested GetYourGuide/Viator route for the frozen activity definitions. Preserve raw failure
reasons and URLs as source-feasibility evidence only. Do not map a row or fit an activity model from this panel.
