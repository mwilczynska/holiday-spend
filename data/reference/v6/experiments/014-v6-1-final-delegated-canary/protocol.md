# 014-v6-1-final-delegated-canary - resumable delegated v6.1 operational canary

**Status:** preregistered 12 August 2026; Stage A is validated call-level 013-v6-1-resumable-delegated-canary reuse plus delegated collection, and Stage B is local deterministic replay.

## Purpose

Experiments 010, 011, 012 and 013 are immutable history. This experiment reuses the registered 20-city frame and only those 013-v6-1-resumable-delegated-canary calls whose raw response and telemetry independently satisfy the frozen contract. Remaining calls are collected by delegated Codex subagents without copying Codex authentication into the application.

## Frozen contract

- Collection mode: `validated_experiment_013_reuse+delegated_codex_subagent`.
- Exactly three source calls per city, using the three registered v6.1 prompts verbatim.
- Search-snippet evidence only; Expedia 4, BudgetYourTrip 4 and Numbeo 2 searches maximum per source; 10 per city; zero direct page reads.
- One raw schema response and one telemetry record per city/source. Missingness is explicit and never substituted.
  - Reused calls retain their source raw/telemetry bytes and record source and target hashes in `reuse-manifest.json`.
- Inventory is independent by call slot. Finalization refuses while any of the 60 registered slots remains pending.
- Frozen Expedia window: arrival 2026-09-17, departure 2026-09-18; reference date 2026-09-17 for BYT and Numbeo.
- Stage B validates every response, invokes `materializeCityCostV61`, then exercises persistence and API provenance parsing.
  - Pass requires at least 19/20 complete cities and artifact candidates no greater than 30% of the batch. Repeated canonical-beer rejection above 30% is an artifact signature and fails the batch.

## Integrity

The registration records the frozen CSV, FX, prompt and implementation hashes. The live CSV and every holdout remain untouched. This experiment may not overwrite an existing experiment directory.
