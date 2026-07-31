# Experiment 013 — interactive official quote extraction

Date: 2026-07-31

## Hypothesis

When given known official booking-engine URLs, a single target-model call can preserve dates and occupancy
and extract exact payable totals for a Copenhagen 4-star property panel. This tests interactive page
capability separately from source discovery and the rejected city-average basis.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_013.md`.
- Target class: one delegated GPT-5.6 Luna invocation per run; no repository provider credential is required.
- City: Copenhagen only; five known official property booking URLs from the accepted direct-property benchmark.
- Fixed stay: 2026-10-22 through 2026-10-29, two adults, one room, seven nights.
- Return exact payable totals only; deterministic code, not the model, divides by nights and computes medians.
- Run three independent one-city invocations and retain dispersion. The supplied URL list is an oracle for
  page capability and is not evidence that production can discover those URLs.

## Acceptance rule

Record exact-date quote coverage, source correctness, tax/occupancy basis, and median error against the
existing accepted direct-property observations. This is not final multi-city validation; it can only promote
the interactive extraction mechanism to a broader one-city source-discovery experiment.

## Telemetry rule

Retain per-invocation page reads, URL attempts, blocked/wrong-date outcomes, and exposed model metadata.
Do not infer provider tokens, latency, cost, or exact parameters.
