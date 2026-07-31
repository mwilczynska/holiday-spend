# Experiment 021 — one-city accommodation class search feasibility

Date: 2026-07-31

## Hypothesis

A search-only route to public city-average class pages may expose explicit 1–4-star hotel prices while
avoiding the date-injection and direct booking-engine failures from Experiments 010–013. The same route may
or may not separate hostel dorm beds from private rooms.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_021_accommodation_search.md`.
- One independent GPT-5.6 Luna-class invocation per city; six cities: Copenhagen, Lisbon, Hanoi, Bangkok,
  San Francisco, and sparse Don Det.
- Exactly six targeted searches per city; no direct URL reads, retries, fallback sources, arithmetic, FX,
  or other-city evidence.
- Accept only exact city, formal star/occupancy class, explicit per-night basis, central numeric value,
  currency, and source URL in the search evidence. Reject `from`, ranges, packages, member rates, and
  unlabelled properties.

## Acceptance and reporting

Report per-class and complete-city coverage, source/citation correctness, blocked and wrong-city outcomes,
query/search counts, and whether any class basis is stable enough for broader validation. This is feasibility
evidence only; it does not validate a model or replace the 30-city/10-holdout requirement.
