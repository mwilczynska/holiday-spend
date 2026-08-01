# Experiment 045 — Trip.com activity definitions

## Hypothesis

Trip.com activity pages expose compatible adult ticket, half-day group, and full-day premium activity snippets
more reliably than the previously tested generic entertainment and attraction routes.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities: Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York City.
- Exactly three ordered Trip.com-restricted searches per call, one per activity definition.
- No reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Promote a measure to a broader Trip.com panel if at least 3/6 cities pass its strict definition.
- A measure can be promoted independently; no generic entertainment substitution is allowed.
- Accepted rows remain one-person source inputs until deterministic scaling and independent 30-city/10-holdout
  accuracy validation pass.

## Results

The six-city panel produced **0/18 accepted cells**: 0/6 for each of
`activities_budget`, `activities_mid_range`, and `activities_high_end`. Every city used exactly three
Trip.com-restricted searches (18 total), with no reads, retries, fallback sources, arithmetic, FX conversion,
aggregation, or cross-city evidence. Most results exposed lowest/“From” prices; the remaining failures lacked
tax status, explicit adult/party basis, compatible duration, or premium status.

**Verdict:** reject Trip.com as a production source route for these strict activity definitions. Preserve the
failure reasons and URLs as source-feasibility evidence; do not map “From” prices or generic tour rows to the
activity tiers. Trip.com may be reconsidered only with a materially different retrieval contract and a new
pre-registered panel. No product mapping or model fitting is allowed from this experiment.
