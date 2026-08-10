# Experiment 006 — delegated development prediction spine

**Status:** preregistered before the delegated batch and complete; development only.

## Purpose

The earlier provider-mode bundle had no prediction rows because this checkout has no provider credential.
This experiment separates the non-deterministic production extraction from deterministic derivation. A
delegated agent runs each versioned production prompt and preserves its raw JSON response; local Stage B
validates the response and invokes the shared `materializeCityCostV6` implementation.

## Fixed sample and protocol

- Cities: the 25 development cities in `inputs.json`.
- Calls: Numbeo, Expedia 3-star, and BudgetYourTrip prompts from `docs/prompts/`.
- Expedia: reuse experiment 001 for its 15 matched cities; collect only the other 10.
- Window: 2026-09-17 to 2026-09-18.
- Search snippets only; zero direct page reads; at most four targeted searches per attempt and one retry
  after a reported block.
- Missingness is explicit and never replaced by a plausible value. FX conversion and all derivation happen
  only in Stage B.
- No holdout file is read by collection, derivation, or scoring.

Raw responses live under `responses/<city>/<source>.json`; telemetry lives under
`telemetry/<city>/<source>.json`. The deterministic output is `results.json` plus one Stage-B bundle per
city under `cities/`.
