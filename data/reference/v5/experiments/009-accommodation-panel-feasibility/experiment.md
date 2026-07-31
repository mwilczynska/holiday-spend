# Experiment 009 — accommodation panel feasibility

Date: 2026-07-31

## Hypothesis

A single GPT-5.6 Luna-class delegated research task can obtain definition-compatible direct observations for the six accommodation classes in a deliberately varied ten-city panel often enough to justify building a matched accommodation ground-truth dataset.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_009.md`
- Target class: GPT-5.6 Luna delegated task, with built-in web retrieval and no provider credential supplied by the repository.
- Cities: Lisbon, Copenhagen, Hanoi, Prague, Bangkok, Barcelona, San Francisco, Da Nang, Nairobi, Don Det.
- Measures: one dorm bed for one person; one private hostel room and 1–4-star hotel rooms for two people, each for one night.
- A `found` fact requires explicit city, class, occupancy, one-night unit, numeric value, currency, URL, and evidence basis.
- Reject ranges, `from` prices, member/mobile/login rates, packages, stale promotions, incompatible occupancy, missing class, and values requiring arithmetic.
- This is a source-feasibility pilot only. It does not fit or validate tier models.

## Acceptance rule

Promote only if strict facts cover enough classes and cities to make a 30-city complete-case panel plausible without relaxing definitions. Otherwise reject the broad one-task collection method and narrow the source design.

## Execution note

The delegated target-class task used web search and page retrieval. The execution surface did not expose an exact provider model ID, sampling parameters, tokens, latency, or monetary cost; those fields therefore remain `null` rather than being inferred.
