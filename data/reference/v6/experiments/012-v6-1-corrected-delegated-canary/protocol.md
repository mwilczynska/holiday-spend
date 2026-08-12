# 012-v6-1-corrected-delegated-canary - corrected delegated v6.1 operational canary

**Status:** preregistered 12 August 2026; Stage A is delegated collection and Stage B is local deterministic replay.

## Purpose

Experiments 010 and 011 are immutable history. This experiment reuses the registered 20-city frame to test the corrected v6.1 source contract without copying Codex authentication into the application.

## Frozen contract

- Collection mode: `delegated_codex_subagent`.
- Exactly three source calls per city, using the three registered v6.1 prompts verbatim.
- Search-snippet evidence only; Expedia 4, BudgetYourTrip 4 and Numbeo 2 searches maximum per source; 10 per city; zero direct page reads.
- One raw schema response and one telemetry record per city/source. Missingness is explicit and never substituted.
- Frozen Expedia window: arrival 2026-09-17, departure 2026-09-18; reference date 2026-09-17 for BYT and Numbeo.
- Stage B validates every response, invokes `materializeCityCostV61`, then exercises persistence and API provenance parsing.
- Pass requires at least 19/20 complete cities and artifact candidates no greater than 30% of the batch. Repeated canonical-beer rejection above 30% is an artifact signature and fails the batch.

## Integrity

The registration records the frozen CSV, FX, prompt and implementation hashes. The live CSV and every holdout remain untouched. This experiment may not overwrite an existing experiment directory.
