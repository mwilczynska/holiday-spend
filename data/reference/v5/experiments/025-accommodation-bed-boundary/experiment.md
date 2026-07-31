# Experiment 025 — accommodation one-bed boundary

Date: 2026-07-31

## Hypothesis

The strict two-adult requirement caused avoidable hostel dorm missingness. Accepting an explicit one-bed
nightly central price as an observed input, then scaling to two travellers in deterministic code, may improve
dorm coverage without weakening hotel-class identity or introducing LLM arithmetic.

## Production-shaped test

Each delegated Luna-class invocation researches exactly one city and issues six bounded searches. Three
independent calls repeat the Experiment 024 cities (Barcelona, Prague, Nairobi) so the boundary change is
paired. No direct reads, retries, fallback sources, currency conversion, arithmetic, or cross-city evidence
are allowed.

## Acceptance and rejection

Accept a dorm row only when it is a non-`from`, central **per-bed per-night** price with exact city/source
identity and named currency. It remains a one-bed observed input; deterministic code owns multiplication by
two. Hotel and private-hostel rows retain the strict two-adult one-room basis. This is retrieval evidence, not
ground truth. Do not fit accommodation ratios unless a separate definition-matched panel reaches 30 complete
cities and a locked holdout of 10 complete cities.

Any non-local display currency is retained exactly and flagged for deterministic FX provenance review; it is
never silently relabelled as the city's local currency.
