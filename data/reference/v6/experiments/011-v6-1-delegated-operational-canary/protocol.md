# Experiment 011 — delegated v6.1 operational canary

**Status:** completed 12 August 2026; the registered gate failed at 17/20, so migration is stopped pending owner review.

## Purpose

Experiment 010 is immutable credential-preflight history and is not rerun. This experiment reuses its representative 20-city frame to test the corrected v6.1 source contract without copying Codex authentication into the application.

## Frozen contract

- Collection mode: `delegated_codex_subagent`.
- Exactly three source calls per city, using the three registered v6.1 prompts verbatim.
- Search-snippet evidence only; Expedia 4, BudgetYourTrip 4 and Numbeo 2 searches maximum per source; 10 per city; zero direct page reads.
- One raw schema response and one telemetry record per city/source. Missingness is explicit and never substituted.
- Frozen Expedia window: arrival 2026-09-17, departure 2026-09-18; reference date 2026-09-17 for BYT and Numbeo.
- Stage B validates the responses, invokes `materializeCityCostV61`, then exercises persistence and API provenance parsing.
- Pass requires at least 19/20 complete cities and artifact candidates no greater than 30% of the batch.

## Integrity

The registration records the frozen CSV, FX, prompt and implementation hashes. The live CSV and every holdout remain untouched.

## Recorded result

Experiment 011 ran all 20 delegated Stage-A frames through local Stage B. Seventeen cities produced complete,
schema-valid three-call records and deterministic 19-tier bundles with field-by-field persistence/API provenance
equality. Two cities were artifact candidates (Cape Town and Lima), which is 10% and therefore below the 30%
artifact threshold. The hard completion gate nevertheless failed because the registered minimum is 19/20.

The three failures were:

- Dubai: all three responses changed the registered city/country identity;
- Cape Town: the BYT response used null `sourceTitle`/`evidenceText` values for missing measures, violating the
  schema and preventing valid source-call records;
- Lima: the Expedia response used null `sourceTitle`/`evidenceText` values for missing measures, with the same
  schema failure.

This is a failed operational canary, not a coefficient or v1-comparison finding. Do not rerun, tune, or proceed to
Phase 8 under the current owner instruction. Experiment 010 remains immutable preflight history. No holdout was
read and the live CSV was not written.
