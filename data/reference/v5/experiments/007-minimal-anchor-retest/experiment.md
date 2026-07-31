# Experiment 007 — minimal-anchor retest

**Date:** 2026-07-31  
**Status:** completed prompt-feasibility experiment; modelling accuracy not tested

## Hypothesis

Reducing the direct contract from 18 to nine strategically selected anchors will raise requested-anchor
coverage on the same difficult panel while preserving strict extraction behaviour.

## Test

One delegated GPT-5.6 Luna-class task used
`docs/prompts/llm_prompt_city_cost_v5_experiment_007.md` for Lisbon, Copenhagen, Hanoi, Prague, and Don
Det. Every response had exactly nine keys. Found facts were audited against retrieved results or opened
canonical pages. No model-derived target, tier, arithmetic, or FX was permitted.

The task made four web-search calls containing 16 queries and one page-read call containing ten URLs. Nine
pages opened; the Don Det Hostelz page returned a cache miss after its search result exposed the city/unit
fact. Exact provider model ID, parameters, tokens, latency, and cost are not exposed by orchestration.

