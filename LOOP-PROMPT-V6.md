# LOOP-PROMPT-V6 — v6.1 coherent-library migration

This is the active autonomous implementation prompt for city cost methodology v6.1. Phases 1–7H and the fresh
experiment-014 canary are now recorded. Experiment 013 remains immutable failed history; experiment 014 passed 20/20
and Phase 8 migration tooling is complete. The owner-approved M4 migration has not reached cutover.

Phase 8 is complete as of 13 August 2026: the frozen protocol and resumable tooling were dry-run on all 20
experiment-014 canary cities, producing deterministic staged/provenance/import-plan artifacts with live writes
forbidden. Phase 9 is active for the remaining 11 cities. The next action is fixed delegated migration batch 010;
do not read a holdout, write the live CSV or execute Phase 11. Batches 001-009 are complete: 110/121 cities are
staged. Their all-prior artifact rates are 10%, 10%, 20%, 0%, 10%, 10%, 10%, 20% and 10%, all below the 30% stop rule. Batch 004 had 0/10
direct drink categories; batch 007 had 4/10, batch 008 had 1/10 and batch 009 had 1/10. Carry that operational coverage finding into Phase 10 without treating
it as a coefficient failure. Batch 007 also produced a duplicate worker report for Budapest without a duplicate
assignment claim or final persisted call record; retain that as an orchestration incident and trust the inventory.

## PROMPT

Copy everything below this line to GPT-5.6 Luna Max.

---

Resume the city cost methodology v6.1 workstream on branch `feat/city-cost-methodology-v6`.

The v6.1 materializer is banked. Your task is to reach a coherent library: repair the production collection
boundary, prove the source contract with delegated agents plus the shipped deterministic path, build a
resumable migration, generate v6.1 results for the frozen 121-city frame, and stop for owner review before
cutover. Keep all 19 tiers.

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

**Current stop:** experiment 013 remains immutable failed history. Experiment 014 is the one authorized fresh canary
and passed 20/20 complete cities with zero artifact candidates and full persistence/API provenance equality. Build and
dry-run Phase 8 now; do not read a holdout or touch the live CSV.

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

## 3. Phase 6 — reconcile the release contract — complete

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

## 4. Phase 7 — repair and test the collection boundary

Experiment 010 is immutable history: it made zero provider calls because the CLI process had no app-provider
key. It is a credential preflight failure, not measured 0/20 source coverage. Do not rerun or mutate it.

### Phase 7A — production collection repair — complete

The following repairs are banked:

1. v6.1 currently uses ordinary JSON completions with no provider web-search tools, although the prompts
   require search snippets. Route it through a genuinely search-enabled provider adapter with observed
   search telemetry; reuse the transport-estimation adapters where practical.
2. `renderPrompt` currently gives Expedia the same arrival and departure date. Accept and preserve distinct
   dates for the frozen one-night window.

Also preserve partial call records/errors, separate source coverage from all-prior materialization, remove
raw-response duplication from development bundles, and extract a tested pure canary evaluator. It must
enforce exactly three records per city, per-source/per-city search ceilings, zero direct reads, retries,
the 30% artifact threshold and field-by-field provenance equality through persistence/API parsing.

Commit target: `fix: repair v6.1 search collection boundary`

### Phase 7B/7D/7E/7F/7G — delegated canary history — stopped

Experiments 011, 012 and 013 are immutable failed history. Experiment 013 reused 32 valid experiment-012 calls,
completed all 60 registered slots and achieved 19/20 complete cities, but a duplicate Prague assignment invalidated
two calls. It also exposed that `evaluateV61CanaryBatch` requires zero per-city problems despite the registered
one-city tolerance. Preserve every experiment unchanged. Phase 7H repaired the assignment and evaluator boundaries;
do not create the next canary until the owner authorizes it.

### Phase 7H — repair the delegated lifecycle and evaluator — complete

The repair is complete. New experiments reserve every city/source slot with an exclusive write-once claim and reject
duplicate claims even when assignment IDs differ; immutable historical ledgers remain readable with their recorded
duplicates. The pure evaluator now permits one incomplete terminal city under the registered 19/20 rule while window,
call-count, search, retry, direct-read, provenance and artifact-signature violations remain batch-fatal. Regression
tests cover both failure shapes. Experiment 014 then used the repaired lifecycle, reusing 58 validated experiment-013
calls and collecting only Prague BYT/Numbeo. Its 60-slot frame is terminal/reusable, 20/20 cities complete, and the
canary passed with zero artifact candidates and full provenance equality. The next action is Phase 8.

Pass only if at least 19/20 cities have three schema-valid source records and complete 19-tier bundles; all
call/search/read/provenance criteria pass; and artifact candidates affect no more than 30% of the batch.
Report source-found/partial/blocked and category fallback separately. All-prior output is availability, not
source coverage, and counts as an artifact candidate for the 30% batch rule. This is operational
source-contract evidence, not holdout accuracy or provider-runtime
reliability.

Commit target: `test: run v6.1 delegated operational canary`

### Phase 7C — provider transport smoke

Production users supply their own key through the web app. Before Phase 11 cutover, run a 3–5-city user-key
smoke of provider authentication, search execution and the real database/API boundary. It is external until
a key is supplied and does not block Phase 8 or Phase 9. Treat ≥95% complete-generation coverage as a
post-release operational SLO; never claim a 19/20 sample statistically establishes it.

## 5. Phase 8 — migration tooling and dry run — active after experiment 014 pass

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

Delegated Codex Stage A is approved for migration when app-provider credentials are unavailable. Use the
exact production prompts and experiment-006 protocol, retain collection mode and raw evidence, and never
label it provider-runtime evidence. Stage B is always the real materializer.

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

- the delegated operational canary fails a pre-registered contract gate;
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
node scripts/run-v6-1-delegated-canary.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/inventory-v6-1-delegated-canary.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check --summary
node scripts/reuse-v6-1-delegated-canary.mjs --target-experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/record-v6-1-canary-assignment.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
```

Add migration `--check` commands in Phase 8. Rerun a failed full suite once before investigating because
this OneDrive checkout has a known transient temp-file failure.

The Phase 9 batch report command is:

```text
node scripts/report-v6-1-migration-batch.mjs --batch-id=<batch> --cities="City A,City B,..."
node scripts/report-v6-1-migration-batch.mjs --batch-id=<batch> --cities="City A,City B,..." --check
```

Phase 8 migration checks are now:

```text
node scripts/migrate-city-cost-v6-1.mjs check
node scripts/import-city-cost-v6-1-provenance.mjs --check
npx vitest run src/lib/city-cost-v6-1-migration.test.ts
```

At the end of every phase, rewrite the handoff with actual completed state and one exact next action. A
handoff that says only “continue” has failed.

---

Resume line:

> Resume v6.1 on `feat/city-cost-methodology-v6`. Read `docs/dev/handoffs/city-cost-v6.md`, then follow
> `LOOP-PROMPT-V6.md` from the first incomplete phase. Experiment 014 has passed, Phase 8 is complete and Phase 9
> is active at 110/121 staged. Assign and process fixed batch 010 next. Never change the live CSV or global default
> before Phase 10 review.
