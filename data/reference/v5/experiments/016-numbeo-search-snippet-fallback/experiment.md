# Experiment 016 — Numbeo search-snippet fallback

Date: 2026-07-31

## Hypothesis

Provider web search can retrieve exact Numbeo food/drink row values from indexed snippets without opening the
rate-limited Numbeo page, preserving one-city production shape and avoiding direct-page 429/503 failures.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_016.md`.
- Target class: one delegated GPT-5.6 Luna invocation per city; no repository provider credential is required.
- Cities: Copenhagen/Denmark and Prague/Czech Republic, each a separate call.
- Five Numbeo-restricted search queries per city; zero direct page reads and no fallback source.
- A found fact requires city, exact row, numeric value, currency, and Numbeo URL in the result evidence.

## Acceptance rule

Promote only if snippets provide auditable exact facts with no third-party or cross-city substitutions and no
material search throttling. Otherwise reject the snippet route and retain the failure outcome.

## Telemetry rule

Retain query count, search calls, result evidence, blocked outcomes, and exposed model metadata. Do not infer
provider tokens, latency, cost, or exact parameters.
