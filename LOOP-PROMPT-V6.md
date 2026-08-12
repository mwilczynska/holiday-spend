# LOOP-PROMPT-V6 — v6.1 coherent-library migration

This is the active autonomous implementation prompt for city cost methodology v6.1. Phases 1–5 built and
hardened the new-city path. The owner has now approved M4: migrate the existing 121-city library after a
live operational canary and a staged owner-reviewed preview.

## PROMPT

Copy everything below this line to GPT-5.6 Luna Max.

---

Resume the city cost methodology v6.1 workstream on branch `feat/city-cost-methodology-v6`.

The v6.1 implementation is banked. Your task is to reach a coherent library: repair the release contract,
measure the real provider path, build a resumable migration, generate v6.1 results for the frozen 121-city
frame, and stop for owner review before cutover. Keep all 19 tiers.

## 0. Read before acting

Read completely, in this order:

1. `docs/dev/handoffs/city-cost-v6.md` — current state and exact first action
2. `docs/dev/plans/city-cost-methodology-v6-1.md` — active phases and Definition of Done
3. this loop
4. `data/reference/v6/validation-manifest-v6-1.json`
5. `data/reference/v6/v6-1-development-release-report.md`
6. `data/reference/v6/v6-1-rollout-preview.md` and adjacent JSON
7. `data/reference/v6/README.md` and `data/reference/v6/data-dictionary-v6.md`
8. `PLAN.md` and `CLAUDE.md`

Then inspect only the code and artifacts needed for the current phase. Do not bulk-read v5 experiments.
Do not open any holdout ledger or holdout score values.

Verify the branch, worktree and `npm run docs:check-memory`. Preserve unrelated changes.

## 1. Settled decisions

1. Keep all 19 planner tiers.
2. Production remains exactly three calls and at most ten searches per city:
   - Expedia 3-star accommodation;
   - BudgetYourTrip food and activity budget/mid/high daily tiers;
   - Numbeo cappuccino and domestic beer.
3. No direct source page reads in production collection.
4. Use the shipped deterministic materializer and one category tier-vector fallback.
5. Do not independently validate every behavioural preset and do not create a new holdout.
6. Migrate the existing 121-city library to v6.1; do not leave the final library mixed between v1 and v6.1.
7. The live CSV remains unchanged until a complete staged artifact receives owner approval.
8. The cutover and rollback each coordinate the CSV and the new-city default.

Choose the smallest implementation satisfying the active plan while preserving v1 rollback and historical
v6.0 replay.

## 2. Banked work — do not revisit

- all 19 v6.1 derivations and response contracts;
- three versioned source prompts;
- 25/25 deterministic development materializations and generated priors;
- v1/v6.0/v6.1 persistence, API and UI provenance;
- Expedia/Booking calibration and accommodation coefficients;
- accommodation development median APEs of 8.27%–25.46%;
- source-dependence disclosures for food, drinks and activities;
- FX additions for SGD, TWD, ZAR and PEN;
- spent holdouts and their historical reports.

Do not refit accommodation, rescore a holdout or tune v6.1 to v1.

## 3. Phase 6 — reconcile the release contract

This is the first incomplete phase.

The generated authority says cocktail/cappuccino is `k=2.4838`, n=14, grade C, ±64%. The active manifest
and some docs still say `2.6`, ±75%. This drift arose during deterministic regeneration; it is not a reason
to refit.

1. Reconcile `validation-manifest-v6-1.json`, `data-dictionary-v6.md`, the v6 README and generated release
   output to `coefficients-v6.json`.
2. Extend `scripts/validate-city-cost-v6-1-release.ts` to compare every duplicated manifest coefficient,
   grade and interval against generated coefficients. Stale declarations must fail `--check`.
3. Replace the generated recommendation with the owner-approved sequence: controlled runtime canary,
   staged 121-city migration, owner-reviewed cutover. Preserve the dated old recommendation as superseded.
4. Regenerate generated artifacts through scripts; never hand-edit them.
5. Run the full baseline, update `LOG.md`, `PLAN.md` and the handoff, commit and push.

Commit target: `fix: reconcile v6.1 release contract`

## 4. Phase 7 — live provider-path canary

Pre-register 20 cities from the existing 121-city frame. Cover every region, multiple cost bands,
source-strong/source-weak cities and non-USD currencies. Freeze the city list, source window, FX snapshot,
provider/model settings, expected calls and gates before collecting.

Run the actual v6.1 runtime provider path. Fixture replay or delegated collection cannot establish runtime
coverage. This is operational migration collection, not a holdout or accuracy fit.

Record one raw response and telemetry row per city/source call, explicit missingness, all materialized
tiers and a persistence/API round trip. Pass only if:

- at least 19/20 cities materialize all 19 tiers;
- each attempted city records three calls, no more than ten searches and zero direct page reads;
- missing values fail closed and reach documented category fallback;
- all v6.1 provenance fields survive persistence and API parsing;
- artifact candidates affect no more than 30% of the batch.

If the canary fails, stop and report. Repair implementation defects only; do not alter coefficients to
match v1. If it passes, regenerate the release result so runtime coverage is measured, then commit/push.

Commit target: `test: measure v6.1 runtime canary`

## 5. Phase 8 — migration tooling and dry run

Create a frozen protocol at `data/reference/v6/migration-v6-1/`. Add deterministic scripts for:

- frozen 121-city frame and input CSV SHA-256;
- one source/reference window and FX snapshot;
- per-city/per-call raw responses and telemetry;
- resumable checkpoint ledger;
- schema validation and response normalization;
- deterministic materialization through `materializeCityCostV61`;
- staged CSV with the exact live schema and row identity;
- full provenance sidecar;
- deterministic import of that sidecar into `city_estimates` with `cities.estimation_id` links;
- impact report and `--check` replay.

Dry-run on the canary. Prove idempotence, interruption/resume and that no command can partially overwrite
the live CSV. The live CSV is read-only in this phase.

Existing experiment 003/006 calls may be reused only if they validate and conform to the frozen migration
window. Record reuse at call level. Never silently mix snapshots.

Commit target: `feat: add resumable v6.1 migration pipeline`

## 6. Phase 9 — staged 121-city migration

Process fixed batches of 10–20 cities. Commit and push after each batch. Each batch must:

1. collect or validly reuse exactly three schema-constrained source responses per city;
2. retain unedited raw responses, telemetry, collection mode, retries, searches and missingness;
3. materialize with shipped code, never copied arithmetic;
4. update checkpoints, staged CSV and provenance sidecar deterministically;
5. report direct/fallback grades and all artifact candidates;
6. pass the verification baseline.

Provider mode is preferred. If provider credentials are unavailable, delegated Stage A is allowed under
the exact production prompts and experiment-006 protocol. It does not satisfy the runtime gate—that was
Phase 7—but it may populate migration source responses. Stage B is always the real materializer.

The maximum is 363 primary calls and 1,210 searches; valid reuse of all 25 fixture cities reduces new
primary calls to 288. Report actual counts. Fail closed; collectors never invent fallback values.

Use the batch decision procedure yourself. Record and continue by default. Stop only if artifact candidates
exceed 30% of a batch or the declared source route is genuinely exhausted.

## 7. Phase 10 — staged impact review, then STOP

When all 121 staged cities are complete, generate:

- every v1/v6.1 city-tier difference;
- category subtotals and representative budget/mid/high baskets;
- median, p10/p90 and tail changes by tier and region;
- all >2×/<0.5× flags;
- ordering, non-negative, duplicate, missing-row and schema checks;
- direct/fallback/grade distributions by category and region;
- ranking diagnostics and batch artifact candidates;
- exact input, staged CSV and provenance hashes.

This is operational impact, not ground-truth validation. Do not tune to v1.

Update the plan, log and handoff, run the baseline, commit and push, then **STOP FOR OWNER REVIEW**. Do not
replace `data/reference/city_costs_app_aud.csv`, change `base_csv_apr_2026` or enable v6.1 globally.

## 8. Phase 11 — cutover only after explicit owner approval

Do not execute this phase under the current prompt. Once approved, atomically generate the live CSV from
the staged artifact, import and link the provenance sidecar for seeded cities, update the seed source label,
switch the new-city default, and verify that `/api/estimates` and `/dataset` expose existing-city v6.1
grades and intervals. Preserve the old CSV hash/artifact and v1 path. Rollback restores both the CSV and
generation default.

## 9. Stop rules

Stop and report only when:

- the canary fails a pre-registered runtime gate;
- artifact candidates exceed 30% of a batch;
- the three-call source route is genuinely exhausted;
- work would require a fourth call, direct page reads, a holdout, accommodation refit or tuning to v1;
- the staged 121-city report is complete and owner review is due;
- the same implementation approach fails three times for the same structural reason.

Do not stop for individual outliers, category fallback, grade D, source-dependent tiers or lack of
independent truth for behavioural presets.

## 10. Guardrails

- No holdout read, score, freeze or collection.
- No accommodation refit.
- No priors derived from current or staged CSV values.
- No hand-edited generated artifact.
- No partial/live CSV write before approval.
- No hidden fallback or modelled value labelled observed.
- Preserve v1 rollback and v6.0 replay.
- Commit and push every phase and migration batch.

## 11. Verification baseline

Run after every phase and batch:

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
```

Add migration `--check` commands in Phase 8. Rerun a failed full suite once before investigating because
this OneDrive checkout has a known transient temp-file failure.

At the end of every phase, rewrite the handoff with actual completed state and one exact next action. A
handoff that says only “continue” has failed.

---

Resume line:

> Resume v6.1 on `feat/city-cost-methodology-v6`. Read `docs/dev/handoffs/city-cost-v6.md`, then follow
> `LOOP-PROMPT-V6.md` from the first incomplete phase. Complete contract repair first, then the live canary
> and staged 121-city migration. Stop for owner review before changing the live CSV or global default.
