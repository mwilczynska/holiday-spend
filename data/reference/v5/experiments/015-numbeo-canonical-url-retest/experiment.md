# Experiment 015 — canonical Numbeo URL retest

Date: 2026-07-31

## Hypothesis

The target web tool can open Numbeo pages when the canonical city-name capitalization is used, while
lowercase slugs cause cache misses or safety failures. A deterministic canonical URL rule should improve
one-city food/drink anchor coverage without fallback search.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_015.md`.
- Target class: one delegated GPT-5.6 Luna invocation per city; no repository provider credential is required.
- Cities: Copenhagen (`Copenhagen`) and Prague (`Prague`), each in its own call.
- Only the canonical direct URL is permitted; no lowercase retry, search, snippet, or other source.
- Compare returned rows with accepted observations where available; retain page dates and source currency.

## Acceptance rule

Promote canonical URL normalization only if both separate calls return valid source rows with no unsupported
substitution. This remains extraction/source evidence, not final 19-field accuracy validation.

## Telemetry rule

Retain per-city page attempts, blocked outcomes, and exposed model metadata. Do not infer provider tokens,
latency, cost, or exact parameters.
