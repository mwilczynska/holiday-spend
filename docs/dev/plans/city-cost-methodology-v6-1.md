# City Cost Methodology v6.1 — Coherent Library Migration

**Status:** New-city implementation banked; release-record repair and M4 migration are active

**Owner decisions:** 10 August 2026 (reachable v6.1 design); 12 August 2026 (migrate the existing 121-city library)
**Branch:** `feat/city-cost-methodology-v6`

This is the active implementation plan. It supersedes the unreachable all-19 independent-validation
objective in `docs/dev/plans/city-cost-methodology-v6.md` and the earlier recommendation to leave the
existing CSV indefinitely on v1. Historical v6.0 evidence and dated conclusions remain valid records and
must not be deleted or rewritten.

## 1. Decisions and finish line

Keep all **19 existing planner fields**. v6.1 uses a deliberately small production method:

- Expedia measures one 3-star accommodation level;
- BudgetYourTrip supplies three food and three activity daily-spend tiers;
- Numbeo supplies cappuccino and domestic draft beer;
- deterministic code applies the banked accommodation ladder, scales BYT values to two people and
  composes the remaining presets;
- every output carries an evidence basis, A/B/C/D grade, interval, source IDs and explicit fallback.

The owner has now approved migrating the existing 121-city library as part of this workstream. The final
state is one coherent v6.1 library for existing and newly generated cities, not an indefinite mixture of
v1 existing cities and v6.1 new cities.

The replacement principle remains:

> Measure source-native city/category spending where it is systematically published. Model the remaining
> product presets explicitly. Never present a preset or fallback as an observed city price.

Migration does not turn v6.1 into ground truth. It is a controlled refresh using a cheaper, reproducible
method with better provenance. The v1 comparison is an operational impact check, never a target to tune
against.

## 2. Banked work — preserve it

- The v6.1 three-call extractor/materializer behind `CITY_COST_METHODOLOGY_V6=true`.
- Explicit v1, historical v6.0 and v6.1 persistence/API/UI handling.
- The 25/25 deterministic development replay and generated v6.1 priors.
- The spent holdouts. No holdout is reopened, rescored or replaced for this migration.
- Expedia 3-star extraction and the Expedia-to-Booking multiplier `0.9361`.
- Accommodation development median APE: 3-star 8.27%, 4-star 13.12%, private 15.97%, 2-star
  16.74%, 1-star 21.49%, dorm 25.46%.
- The accommodation ladder and disclosures, including the private rollback.
- One direct → regional → global category-tier fallback, decoupled from the live CSV.
- Current 25-city direct category coverage after FX repair: accommodation 80%, food 96%, drinks 68%,
  activities 96%.
- The unchanged v1 CSV and flag-off path as the pre-cutover rollback baseline.

Do not refit accommodation, manufacture independent food/drink/activity validation or revive v5's
unreachable gates.

## 3. Frozen v6.1 production shape

| Call | Source | Extract | Maximum searches |
| --- | --- | --- | ---: |
| A | Expedia | one 3-star room level for two adults | 4 |
| B | BudgetYourTrip | food budget/mid/high and activity budget/mid/high, per person/day | 4 |
| C | Numbeo | cappuccino and domestic draft beer | 2 |

Total: **three calls and at most ten searches per city**. Production uses search snippets, no direct
page reads, no source account, no paid API and explicit source-level missingness.

The 19-tier derivation remains the shipped library implementation:

- six accommodation tiers use the calibrated Expedia anchor and banked ladder;
- `food_budget`, `food_mid_range` and `food_high_end` are twice the matching BYT per-person/day tier;
- `food_street_food = 0.5331 × food_budget`, grade D ±45%, as a compatibility preset;
- five drink tiers compose cappuccino, beer and a modelled cocktail; wine remains excluded;
- `activities_free = 0`; the other three activity tiers are twice the matching BYT daily tier.

Generated coefficients are the authority for numeric fitted relations. As at 12 August 2026,
`coefficients-v6.json` contains `cocktail_1 = 2.4838 × cappuccino_1`, n=14, grade C, interval ±64%.
The v6.1 manifest now declares that same contract and the release validator fails closed if the declaration
drifts from the generated artifact.

## 4. Evidence interpretation

- Accommodation has genuine development accuracy evidence and a spent conditional holdout result.
- BYT food and activities are source-backed product estimates, not independent validation truth.
- Drinks are source-priced behavioural presets without independent full-basket truth.
- Runtime ≥95% coverage is **unmeasured**. The 25/25 fixture replay proves deterministic replay, not
  live provider-path success.
- The 25-city rollout preview is operational impact evidence only. Across 450 non-zero comparable
  city/tier rows, 81 lie above 2× or below 0.5× v1; `food_high_end` is above 2× v1 in 18/25 cities.
  Representative basket median changes are +36.65% budget, +11.53% mid-range and +31.90% high-end.
  These differences do not establish that v6.1 is wrong because v1 is not ground truth, but they make a
  staged migration and explicit review mandatory.

## 5. Completed phases

### Phases 1–5 — implementation and release hardening — **complete**

- Added v6.1 response contracts and three versioned source prompts.
- Implemented the deterministic 19-tier materializer and category fallback.
- Built generated priors and 25-city fixtures without reading the live CSV.
- Fixed v6.1 persistence, API and UI provenance while preserving v1 and v6.0 replay.
- Made release gates computed or explicitly external/unmeasured.
- Added SGD, TWD, ZAR and PEN to the frozen FX snapshot, taking drink direct coverage from 52% to 68%
  and prior exclusions from 34 rows to zero.
- Generated the read-only 25-city v1-versus-v6.1 rollout preview.

The earlier “complete for new cities; M4 separate” conclusion is superseded by the 12 August owner
decision. The implementation is banked; the library migration is not complete.

## 6. Active phases

### Phase 6 — reconcile the release contract — **complete 12 August 2026**

1. Reconciled `validation-manifest-v6-1.json`, the generated reports and active documentation with the
   generated cocktail coefficient (`2.4838`, n=14, ±64%).
2. Extended `scripts/validate-city-cost-v6-1-release.ts` so the manifest coefficient key, source anchor,
   value, grade, interval, authority and relation text are compared with generated coefficients. A stale
   declaration now fails `--check`; the negative regression was confirmed with the old `2.6`, ±75% values.
3. Superseded the generated report's “new-city-only ready” recommendation with the owner-approved sequence:
   controlled runtime canary → staged full-library migration → owner-reviewed cutover.
4. Regenerated the release validation and rollout artifacts through scripts without network calls.
5. The full baseline for this phase passed; the live CSV and holdouts were untouched.

### Phase 7 — measure the live provider path with a canary

**Status after 12 August 2026 attempt: STOPPED — failed 0/20; provider credential required before retry.**

The preregistered run is `data/reference/v6/experiments/010-v6-1-runtime-canary/`. It exercised the actual
`generateCityCostEstimate` path with the v6.1 flag and failed closed for all 20 registered cities because
the server had no `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`. No fixture, delegated response,
v1 comparison, holdout read or CSV write substituted for the missing provider. Phase 8 must not start until
the same registration is rerun with a real provider and reaches the 19/20 gate.

Pre-register a representative **20-city operational canary** drawn from the existing 121-city frame. It
must span all regions, cost bands, source-strong and source-weak cities, and include non-USD currencies.
Use the actual runtime provider path, not fixture replay, with exactly the production prompts and limits.

The canary is operational collection for the approved migration, not a holdout and not a coefficient fit.
Record raw schema responses, telemetry, explicit missingness, materialized output and persistence/API
round-trip results. Never tune against v1 or any holdout.

The canary passes only when:

- at least 19/20 cities materialize all 19 tiers (the manifest's ≥95% runtime clause);
- every attempted city has exactly three source-call records and at most ten searches;
- direct page reads are zero;
- missing facts remain explicit and reach the documented grade-D category fallback;
- methodology `v6.1`, all 19 grades and intervals, anchors, source map, telemetry, missingness, prior basis
  and input snapshot survive persistence and API parsing;
- no batch-level artifact signature affects more than 30% of the canary.

If it fails, stop and report the measured failure. Repair implementation/contract defects and rerun only
when the failure did not expose or consume validation data; do not change coefficients to make the canary
look like v1.

### Phase 8 — build resumable migration tooling and a dry run

Create a deterministic migration protocol under `data/reference/v6/migration-v6-1/` containing:

- a pre-registration and frozen city frame;
- SHA-256 of the input 121-city CSV;
- one frozen FX snapshot and one declared collection/reference window;
- raw response and telemetry files per city/source call;
- a checkpoint/status ledger so interrupted work resumes without recollecting completed calls;
- normalized spine bundles and deterministic 19-tier materializations;
- a staged CSV with exactly the existing schema and row identity;
- a provenance sidecar carrying methodology version, source facts, grades, intervals, missingness,
  telemetry, prior basis and input snapshot for every city;
- a deterministic seed/import path that writes that sidecar into `city_estimates` and links each seeded
  city through `cities.estimation_id` so existing-city provenance is visible at runtime;
- deterministic validation and `--check` regeneration.

The live CSV must not be used to derive v6.1 priors. Existing experiment 003/006 responses for 25 cities
may be reused only if each response validates against the current schema and conforms to the frozen
migration window/source policy; otherwise recollect it. Record reuse at the call level—never mix snapshots
silently.

Before any bulk collection, dry-run the pipeline on the canary and prove that it is resumable, idempotent
and cannot partially overwrite the live CSV. Commit and push the tooling.

### Phase 9 — collect and materialize the 121-city frame

Process fixed batches of 10–20 cities. For each batch:

1. collect or validly reuse the three schema-constrained spine responses;
2. validate source/search limits and explicit missingness;
3. materialize through the real `materializeCityCostV61` implementation;
4. update the checkpoint, staged CSV and provenance sidecar deterministically;
5. run batch substance checks and the verification baseline;
6. record coverage/fallback counts, commit and push.

The upper bound is 363 primary source calls and 1,210 searches. If all 25 existing fixture cities qualify
for reuse, 288 new calls remain. These are planning bounds, not a promise; the protocol must report actual
calls, retries, searches and reuses.

Provider mode is preferred. If the environment lacks provider credentials, schema-constrained delegated
collection may supply Stage A exactly as experiment 006 did, but every call must use the production prompt
verbatim, retain an unedited raw response and telemetry, and record `collectionMode`. Stage B must always
be the shipped deterministic materializer. No plausible substitute may be inserted by the collector.

### Phase 10 — staged impact review and cutover decision

Generate, from the complete staged artifact:

- 121-city and 19-tier v1-versus-v6.1 differences;
- category subtotals and representative budget/mid/high daily baskets;
- median, p10/p90 and tail changes by tier and region;
- every >2× or <0.5× flag;
- ordering, non-negativity, duplicate, missing-row and schema checks;
- source-direct/fallback/grade distributions by category and region;
- ranking-change diagnostics and a list of all batch artifact candidates;
- the exact staged CSV and provenance hashes.

This report is not ground-truth validation. Do not tune v6.1 to resemble v1. **Stop for owner review
before replacing `data/reference/city_costs_app_aud.csv` or changing the default flag.**

### Phase 11 — atomic cutover and rollback — requires owner approval after Phase 10

After explicit approval:

1. replace the live CSV from the generated staged artifact—never by hand;
2. import the generated provenance sidecar into `city_estimates`, link `cities.estimation_id`, and update
   the seed/import source label from `base_csv_apr_2026` to a versioned v6.1 migration label;
3. prove `/api/estimates` and `/dataset` expose v6.1 grades, intervals and provenance for seeded existing
   cities, not only newly generated cities;
4. make v6.1 the coordinated default for newly generated cities;
5. retain the old CSV hash/artifact and v1 generation path as one documented rollback unit;
6. test seed/bootstrap, planning, comparison and generation provenance;
7. regenerate documentation and release artifacts, run the full baseline, commit and push.

Rollback must restore **both** the previous CSV and the v1 new-city default. Reverting only the feature
flag after migrating the CSV would recreate a mixed-method library and is not a complete rollback.

## 7. Definition of Done

The workstream is complete only when:

1. all contract declarations agree with generated coefficients and validator checks enforce that agreement;
2. a 20-city live provider canary measures ≥95% runtime coverage and provenance round-trip;
3. the migration protocol is frozen, resumable, deterministic and independent of the live CSV;
4. all 121 existing cities have complete staged v6.1 values and provenance, or an explicit owner-approved
   exclusion that does not silently retain v1 values;
5. the full operational impact report has been reviewed by the owner;
6. the approved staged artifact atomically replaces the live CSV and its provenance sidecar is imported
   and linked for all seeded existing cities;
7. v6.1 is the consistent default for existing and new cities;
8. the coordinated v1 rollback is tested and documented;
9. no holdout was read or rescored and no accommodation coefficient was refit;
10. the verification baseline passes, the tree is clean and the branch is pushed.

M5 improvements to weak individual tiers are not required for M4 unless the runtime canary reveals a
batch-level implementation artifact. They remain later evidence improvements.

## 8. Guardrails and stop rules

- Do not read, rescore, freeze or replace any holdout.
- Do not refit accommodation or tune any coefficient against v1.
- Do not add a fourth production source call or exceed ten searches per city.
- Do not use direct page reads in production collection.
- Do not derive priors from the current or staged shipping CSV.
- Do not hand-edit generated coefficients, priors, materializations, reports or the staged/live CSV.
- City-price collection is authorized only for the Phase 7 canary and Phase 9 migration under the frozen
  three-call contract.
- Preserve explicit source missingness; category priors are applied only by the materializer.
- Commit and push after each phase and each bulk batch.
- Stop on a canary gate failure, a batch-level artifact signature affecting >30% of a batch, exhaustion of
  the declared source route, or before the Phase 11 cutover. Do not stop for individual outliers.
- Preserve historical v6.0 replay and all dated superseded conclusions.

## 9. Verification baseline

Run after every phase and migration batch:

```text
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
node scripts/fit-city-cost-ladder-v6.mjs --check
node scripts/test-city-cost-v6-ground-truth-warnings.mjs
node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete
node scripts/build-city-cost-v6-1-priors.mjs --check
node scripts/materialize-city-cost-v6-1-development.mjs --check
node scripts/validate-city-cost-v6-1-release.mjs --check
node scripts/generate-city-cost-v6-1-rollout-preview.mjs --check
node scripts/run-v6-1-runtime-canary.mjs --check
```

Add migration-specific `--check` commands when Phase 8 creates them. If the full test suite fails, rerun
it once before investigating because this OneDrive checkout has a known transient temp-file failure.
