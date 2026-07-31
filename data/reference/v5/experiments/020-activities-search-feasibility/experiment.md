# Experiment 020 — one-city activity anchor search feasibility

Date: 2026-07-31

## Hypothesis

Search-only extraction can obtain definition-compatible activity anchors for at least some cities without
arbitrary URL reads, arithmetic, or estimates: a standard paid attraction ticket, a 3–5 hour shared activity,
and a 6–10 hour premium activity.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_020_activities.md`.
- One independent GPT-5.6 Luna-class invocation per city; city context is never shared.
- Cities: Copenhagen, Lisbon, Hanoi, Bangkok, San Francisco, and sparse Don Det.
- Exactly three provider searches per city, one targeted search per activity anchor; no direct page reads,
  retries, fallback sources, arithmetic, FX, or other-city evidence.
- Found evidence must contain exact city, activity/attraction, adult or per-person basis, duration where
  required, numeric central value, currency, and source URL. `from`, range, package, deposit, login-only,
  and incompatible-duration results are not found.

## Acceptance and reporting

Report cell and complete-city coverage by city/cost band, source/evidence correctness, duration compliance,
search counts, blocked outcomes, and whether any modelable anchor is feasible. This is a source-feasibility
experiment only; `activities_free = 0` remains definitional and excluded from scoring.
