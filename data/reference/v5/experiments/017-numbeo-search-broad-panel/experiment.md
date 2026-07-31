# Experiment 017 — broad one-city Numbeo search validation

Date: 2026-07-31

## Hypothesis

The Numbeo-restricted search-snippet route promoted by Experiment 016 remains source-correct and usable
across regions, cost bands, and sparse destinations when each city is handled by its own target-model call.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_016.md`.
- Target class: one delegated GPT-5.6 Luna invocation per city; no repository provider credential is required.
- Cities, deliberately separate calls: Lisbon/Portugal (Europe, mid), Hanoi/Vietnam (Asia, low),
  Bangkok/Thailand (Asia, mid), San Francisco/United States (North America, high), Nairobi/Kenya (Africa,
  low/mid), and Don Det/Laos (Asia, sparse).
- Five Numbeo-restricted searches per city; zero direct page reads and no fallback source.
- A found fact requires exact city, row, central value, currency, and canonical Numbeo URL in result evidence.

## Acceptance rule

Report per-city coverage, source/citation correctness, blocked/rate-limited outcomes, and query/search counts.
Compare to retained observations where definition/date-compatible rows exist. Promote only if no material
regional/cost-band/sparse-city failure is hidden by the aggregate; this is still not final 30-city holdout
validation.

## Telemetry rule

Retain each one-city raw response and telemetry. Do not infer provider tokens, latency, cost, or exact
parameters.
