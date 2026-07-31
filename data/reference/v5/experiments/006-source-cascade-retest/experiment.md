# Experiment 006 — source-cascade retest

**Date:** 2026-07-31  
**Status:** completed delegated target-class prompt pilot; not final provider-path or accuracy validation

## Hypothesis

The explicit source ordering and category query allocation in
`docs/prompts/llm_prompt_city_cost_v5_experiment_006.md` will improve accommodation and activity
coverage over Experiment 005 without causing invented values, arithmetic, FX, or tier output.

## Pre-registered comparison

- Same five cities: Lisbon, Copenhagen, Hanoi, Prague, Don Det.
- One delegated GPT-5.6 Luna-class task; no user API credential.
- All 18 keys required for every city.
- Compare fact coverage by city, measure, accommodation, and activities against Experiment 005.
- Audit every `found` fact against its cited search result or canonical page.
- A missing compatible class, occupancy, adult basis, or duration remains `not_found`.

## Execution

The task made five web-search calls containing 20 queries and one page-read call containing eight URLs.
Six direct pages opened successfully; two relevant reads failed (a Don Det Hostelz cache miss and an
internal error on the National Museum of Denmark page). Search retrieval exposed the exact fact and cited
URL for both failed opens, which the prompt permits. The orchestration surface did not expose exact provider
model ID, sampling parameters, tokens, latency, or cost.

Artifacts: `raw-responses.json`, `results.json`, and `verdict.md`.

