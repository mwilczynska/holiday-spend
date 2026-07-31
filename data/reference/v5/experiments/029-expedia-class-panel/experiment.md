# Experiment 029 — broader Expedia 2–4-star class panel

Date: 2026-07-31

## Hypothesis

The Expedia class-trend route promoted in Experiment 028 will maintain useful 2–4-star coverage across a
broader city sample, while 1-star remains a separately measured missingness outcome.

## Production-shaped test

Each Luna-class invocation researches exactly one city with the unchanged Experiment 028 prompt and exactly
four Expedia-restricted searches. This first tranche tests Bangkok (Thailand), San Francisco (United States),
and Nairobi (Kenya), one independent invocation per city. No direct reads, retries, fallback sources,
arithmetic, FX conversion, or cross-city evidence are allowed.

## Acceptance

Use the deterministic Experiment 028 audit: exact city/class/two-adult/average-or-trend/reference-window and
non-`from` numeric value. Record duplicate search operations as protocol deviations. This tranche measures
source feasibility only; no model is fitted until a pre-registered 30-city/10-holdout panel is complete.
