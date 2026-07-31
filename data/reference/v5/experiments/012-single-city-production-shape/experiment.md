# Experiment 012 — single-city production-shape repeatability

Date: 2026-07-31

## Hypothesis

The partially promoted direct class-page method remains usable when the production interaction is reduced
to one city per invocation, rather than a research task that asks for a city panel. Three independent
single-city invocations should return comparable 3-star/4-star observations and preserve the same strict
missingness for lower classes and hostels.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_012.md`.
- Target class: GPT-5.6 Luna delegated invocations; no repository provider credential is required.
- City: Copenhagen, Denmark (`dk`, `europe`, `denmark`, `copenhagen`).
- Run three independent invocations, retaining each raw response; do not average them away.
- Direct sources: Booking one/two/three/four-star pages and Hostelworld city/private-room pages.
- Compare each 4-star result with the independent Copenhagen direct-property median of DKK 1,417.43
  from `data/reference/observations/accommodation-copenhagen-shoulder-2026-07-24.jsonl`, using the
  frozen 2026-07-22 FX snapshot only for deterministic currency comparison. This is a basis comparison,
  not a claim that the dated direct-property quote and city average are identical estimands.

## Acceptance rule

Report schema validity, found/missing cells, between-run dispersion, source correctness, and the 4-star
ground-truth comparison. This experiment cannot pass the final methodology gates: it is a production-shape
and repeatability pilot with one city and one directly matched class.

## Telemetry rule

Retain per-invocation search/page-read counts and any model metadata exposed by delegation. Do not infer
provider tokens, latency, cost, or exact parameters.
