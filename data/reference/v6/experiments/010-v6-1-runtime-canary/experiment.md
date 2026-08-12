# Experiment 010 — v6.1 runtime canary

**Status:** preregistered before collection
**Collection status:** pending execution; see `results.json` and `verdict.md` after the run.

## Purpose

Measure the actual v6.1 production provider path before the staged migration of the existing 121-city
library. This is an operational canary, not a holdout, not ground-truth validation and not a coefficient
fit. It must exercise `generateCityCostEstimate` with `CITY_COST_METHODOLOGY_V6=true`, the three shipped
v6.1 prompts, the frozen FX snapshot and the shipped `materializeCityCostV61` implementation.

## Frozen inputs

The exact city frame, source window, prompt hashes, CSV hash, FX snapshot and acceptance criteria are in
`registration.json`. The frame covers all nine CSV regions, low/mid/high cost bands, cities with complete
and incomplete development-fixture source coverage, and non-USD currencies. The input CSV is read only;
the canary must not modify it.

## Production constraints

- Exactly three source calls per city: Expedia 3-star, BudgetYourTrip daily food/activity tiers, Numbeo drinks.
- At most ten targeted search snippets per city: 4 + 4 + 2.
- Zero direct page reads.
- At most one retry after a reported block.
- Missingness remains `not_found`, `blocked`, `stale` or `class_absent`; no collector substitution.
- Stage B is always the shipped deterministic materializer; no v1 comparison or coefficient tuning is allowed.

## Required audit outputs

For every attempted source call, retain the parsed schema response as `rawResponses`, the call telemetry,
and any error. For every successful city, retain the v6.1 collection, 19-tier materialization and the
adapter/API provenance round-trip check. A successful round trip must preserve methodology version, all
19 grades and intervals, source facts/anchors, three-call telemetry, missingness, prior basis and input
snapshot.

## Pass rule

The canary passes only with at least 19/20 complete cities, all source/search/direct-read limits satisfied,
all successful cities complete through 19 tiers, the provenance round-trip passing for each successful city,
and no artifact signature affecting more than 30% of the canary. Any failed pass criterion is recorded and
the migration stops for owner/implementation review; it is not repaired by making v6.1 resemble v1.

## Holdout and migration boundary

No holdout file is read, scored or frozen. No staged or live CSV is written. This experiment may be rerun
only after a failed gate is diagnosed without consuming validation data; a missing provider credential is
a failed runtime-coverage gate, not permission to substitute fixtures or delegated collection.
