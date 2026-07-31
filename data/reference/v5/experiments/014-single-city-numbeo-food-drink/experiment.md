# Experiment 014 — single-city Numbeo food/drink extraction

Date: 2026-07-31

## Hypothesis

The direct Numbeo city page is a stable, free, signed-out source that a target-class one-city call can read
for the five food/drink anchor rows without arithmetic or unsupported substitutions.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_014.md`.
- Target class: one delegated GPT-5.6 Luna invocation per city; no repository provider credential is required.
- Cities: Copenhagen/Denmark (`copenhagen`), Lisbon/Portugal (`lisbon`), Prague/Czech Republic (`prague`).
- Each city is a separate call and separate raw artifact; no prompt asks for a city panel.
- Ground truth: compare found values and source rows with accepted Numbeo observations already retained under
  `data/reference/observations/`; differing retrieval dates are reported rather than silently treated as error.

## Acceptance rule

Promote the source contract only if each call passes schema/source audit and the page-value correspondence is
reliable. This is source and extraction evidence, not final model accuracy or complete 19-field validation.

## Telemetry rule

Retain per-city page reads, search fallback, blocked outcomes, and exposed model metadata. Do not infer
provider tokens, latency, cost, or exact parameters.
