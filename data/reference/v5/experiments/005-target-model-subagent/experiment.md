# Experiment 005 — target-model sub-agent prompt feasibility

**Date:** 2026-07-31  
**Status:** completed prompt-feasibility pilot; not final provider-path or accuracy validation

## Hypothesis

A spawned GPT-5.6 Luna-class agent can obey the v5 extraction contract without a user-supplied API key,
use its available web retrieval, avoid arithmetic/FX/tier generation, and fail closed on unsupported facts.

## Pre-registered pilot

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_001.md`
- Cities: Lisbon, Copenhagen, Hanoi, Prague, Don Det
- One spawned target-class agent task; web retrieval within that task
- Every response retains all 18 measure keys
- A fact is `found` only when the web-search result displayed the exact city value
- Missing compatible evidence remains `not_found`; no memory estimates
- This pilot tests schema/instruction feasibility. It does not score price accuracy and is not the
  production provider endpoint.

## Execution

The five response objects were revalidated locally with `validatePayload` from
`scripts/run-city-cost-v5-one-call.mjs`; all five passed with zero schema errors.

The agent issued 11 search queries across three web-search tool calls and attempted four direct page reads.
All four direct Numbeo page reads returned HTTP 503. Search retrieval nevertheless displayed compatible
city restaurant values for four cities. Don Det produced no compatible published price. The orchestration
surface did not expose token counts, monetary cost, exact provider model ID, or provider sampling parameters.

Artifacts:

- `raw-responses.json` — five complete raw JSON contracts
- `results.json` — deterministic counts and limitations
- `verdict.md` — interpretation
