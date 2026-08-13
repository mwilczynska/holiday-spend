# Handoff — City Cost Methodology v6.1

**As at:** 12 August 2026

**Branch:** `feat/city-cost-methodology-v6`

**Phase 6 completed commit:** `07a1c0a`
**Phase 7A repair commit:** `0c52a23`
**Phase 7 canary result commit:** `1bc352f` (experiment 010 preflight only)
**Phase 7 first attempt:** credential preflight only; superseded as a canary result
**Phase 7B delegated canary:** failed 17/20; experiment 011 retained for owner review
**Phase 7B result commit:** `82586f5`
**Phase 7D boundary repair:** complete in `a7f00be`; experiment 011 remains immutable
**Phase 7E corrected canary:** experiment 012 failed 10/20; immutable result recorded below
**Phase 7F lifecycle repair:** complete in `511837f`; experiments 010/011/012 remain byte-unchanged
**Phase 7G resumable canary:** experiment 013 immutable failure at 19/20
**Phase 7H lifecycle/evaluator repair:** complete in `04be79b`; baseline passed
**Phase 7 fresh corrected canary:** experiment 014 passed 20/20; immutable result recorded below

**Milestone:** M4 coherent migration of the 121-city library — **Phase 7 canary complete; Phase 8 active**
**Exact next action:** build and dry-run the frozen resumable migration protocol under
`data/reference/v6/migration-v6-1/` using experiment 014 as the canary fixture. Do not mutate experiments 010–014,
read any holdout or touch the live CSV.

**Current milestone correction:** the earlier “Phase 7B failed; migration stopped” wording above is superseded
by the owner-authorized Phase 7D repair and one fresh corrected canary. Experiment 012 failed because delegated
Stage A supplied only 30/60 source-call records: 10/20 cities completed, 10/20 were artifact candidates (50%).
Phase 7F now exposes the underlying 32 reusable pairs and 28 pending slots without erasing sibling evidence, and
refuses finalization while any registered slot is pending. Experiment 012 has no assignment ledger, so the inventory
reports assignment attempts as unrecorded while still separating telemetry records from actual provider attempts.
Experiment 013 then completed its 60-slot frame but remains an immutable failure at 19/20 because a duplicate Prague
assignment invalidated two call records. Phase 7H repaired the lifecycle/evaluator boundary, and experiment 014 then
passed the fresh canary at 20/20 with zero artifact candidates and full provenance equality. Phase 8 is now active.

This is the cold-start document for GPT-5.6 Luna Max. It supersedes the earlier recommendation to stop
after new-city-only activation. The implementation is banked, but the workstream is not complete until
existing and new cities use one coherent v6.1 methodology after an owner-reviewed cutover.

## 1. Read in this order

1. This file.
2. `docs/dev/plans/city-cost-methodology-v6-1.md`.
3. `LOOP-PROMPT-V6.md`.
4. `data/reference/v6/validation-manifest-v6-1.json`.
5. `data/reference/v6/v6-1-development-release-report.md`.
6. `data/reference/v6/v6-1-rollout-preview.md` and its adjacent JSON.
7. `data/reference/v6/README.md` and `data/reference/v6/data-dictionary-v6.md`.
8. `PLAN.md` and `CLAUDE.md`.

Then inspect only files needed by the current phase. Do not bulk-read v5 experiments and do not open any
holdout ledger or score values.

Before editing, verify the branch, worktree and `npm run docs:check-memory`.

## 2. Owner decisions

### 10 August — reachable v6.1

- Keep all 19 planner tiers.
- Use exactly three bounded source calls: Expedia 3-star, BYT food/activity daily tiers and Numbeo
  cappuccino/beer.
- Model the remaining presets in deterministic code with honest grades and one category fallback.
- Do not require independent ground truth for behavioural presets where no independent source exists.
- Do not reopen or replace any holdout.

### 12 August — coherent library migration

- Migrate all 121 existing cities to v6.1 as part of this workstream.
- First repair the release record, then measure the real provider path with a representative 20-city
  canary.
- Build a resumable staged migration; do not manually edit or partially overwrite the live CSV.
- Stop for owner review after the complete 121-city staged impact report and before cutover.
- After approval, migrate the CSV and new-city default as one coordinated release. Rollback must restore
  both; an indefinite mixed v1/v6.1 library is not the finish line.

This decision supersedes the generated Phase 5 recommendation of “new cities only.” That recommendation
was reasonable before owner review and remains in dated artifacts as history; do not delete it.

### 12 August — delegated development collection and user-key production boundary

- Production users supply their own provider key through the web app for new-city generation.
- Development and migration Stage A may use Codex subagents under the exact production prompts and limits;
  the shipped parser, materializer, persistence adapter and API parser remain the deterministic Stage B.
- A delegated canary proves source-contract feasibility, not provider authentication or population runtime
  reliability. A small user-key provider smoke remains required before cutover; ≥95% is a monitored runtime
  SLO rather than a claim inferred from 19/20.
- Experiment 010 made no provider calls and is a credential preflight record, not measured source coverage.

## 3. State of the world

Banked and verified:

- v6.1 contracts, three prompts and the deterministic 19-tier materializer;
- generated priors decoupled from the v1 CSV;
- 25/25 development fixture materialization;
- v1/v6.0/v6.1 persistence, API and dataset provenance handling;
- computed release gates, with runtime ≥95% coverage honestly marked unmeasured and verification marked
  external;
- Phase 6 release-contract reconciliation: the manifest now declares generated cocktail `k=2.4838`, grade C,
  ±64%, and the release validator fails closed when that declaration drifts;
- SGD/TWD/ZAR/PEN FX maintenance: prior exclusions fell 34 → 0 and drink direct coverage rose 52% → 68%;
- read-only rollout preview against the unchanged v1 CSV;
- the Phase 7 canary registration and credential-preflight record;
- Phase 7A search-enabled collection repair, distinct Expedia date handling, strict call preservation,
  pure canary evaluator and provenance round-trip fields;
- delegated experiment 011 raw responses and telemetry for all 20 cities, with 17 complete Stage-B bundles;
- the recorded Phase 7B failure: Dubai identity drift, Cape Town schema-invalid BYT missingness, Lima
  schema-invalid Expedia missingness, and two artifact candidates (10%);
- Phase 7D repairs in the working tree: shared canonical identity comparison, safe non-observed documentary
  normalization, independent preservation of all source records, canonical 0.5-Liter/1-Pint Numbeo beer labels,
  category artifact-signature detection, immutable experiment registration and hashed release evidence;
- the release validator now reports experiment 011 as failed 17/20 from its hashed result artifact, not pending;
- the verification baseline after the failed canary, with the canary gate itself recorded as failed;
- no bulk migration responses or staged CSV.

Current production state:

- the live 121-city CSV is still v1 and must remain unchanged until Phase 11 approval;
- the feature flag is opt-in and flag-off remains v1;
- experiment 010 made zero provider calls because no `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or
  `GEMINI_API_KEY` was configured. It is not a measured 0/20 source result;
- experiment 011 is immutable boundary-regression history at 17/20; experiment 012 is the one authorized corrected
  delegated canary and failed at 10/20 with 50% artifact candidates because Stage A did not complete its 60-call frame;
  experiment 010 remains immutable preflight history;
- no bulk migration responses or staged CSV exist yet;
- all holdouts are spent/closed and irrelevant to the operational migration.

## 4. Phase 6 result and remaining release issues

The generated authority and release declarations drifted during FX regeneration. Phase 6 resolved the drift:

- `data/reference/v6/coefficients-v6.json`: cocktail/cappuccino `k=2.4838`, n=14, grade C, ±64%;
- `data/reference/v6/validation-manifest-v6-1.json`: schema v3 now declares `k=2.4838`, grade C, ±64%;
- the validator compares the manifest key, source anchor, value, grade, interval, authority and relation text
  with the generated coefficient;
- the negative regression with the old `2.6`, ±75% declaration failed as required;
- generated release and rollout reports now describe the approved staged migration sequence.

Accommodation coefficients and the Expedia/Booking offset did not change. The Phase 7D release work is now the
corrected collection boundary: the shared country comparator accepts registered aliases, null documentary fields
are normalized only for non-observed measures, invalid source calls no longer erase sibling calls, canonical
Numbeo beer labels are accepted without conversion, and the hashed experiment result drives the release gate.
Phase 7F is now complete: the independent inventory and finalization guard are in place. Phase 7H has now completed the
write-once assignment claims and evaluator batch predicate repair; Phase 8 migration tooling remains blocked until a
fresh canary passes. The user-key smoke remains external and required before Phase 11 cutover.

## 4a. Phase 7 experiment 010 — superseded as a canary result

`data/reference/v6/experiments/010-v6-1-runtime-canary/` is preregistered for 20 cities with the frozen
CSV/FX/prompt hashes and ran `generateCityCostEstimate` with `CITY_COST_METHODOLOGY_V6=true`. The result is
**0/20 complete**, required **19/20**. All cities failed closed before a source call because this checkout
has no configured provider credential. The result records the exact missing-key error for every city;
there were no fixture, delegated or v1 substitutions, no holdout reads, and no CSV writes.

The audit established that no source call ran. It also found two defects that a key would not fix: the
provider client does not enable web search, and Expedia receives the same arrival and departure date. The
canary evaluator additionally omits registered gates and can count all-prior materializations as source
coverage. Preserve experiment 010 unchanged as the failed preflight record; do not rerun it.

Phase 7A repaired those implementation defects. Phase 7B used Codex subagents for the same representative
city frame and the exact production prompt/schema/search contract, then fed
the responses through shipped Stage B. Phase 7C is a later 3–5-city user-key provider transport/database/API
smoke. Phase 8 is blocked by the failed Phase 7B and 7E gates; do not treat delegated partial success as authorization to migrate.

## 4b. Phase 7D/7E result and exact next action

Experiment 011 is immutable failed history: 17/20 complete, two artifact candidates (10%), 60 attempted calls,
198 searches and zero direct reads. Its failures were boundary defects, not coefficient evidence. Phase 7D repaired
those boundaries in `a7f00be`. The one authorized corrected run, experiment 012, then produced only 30/60 source
records before delegated Stage A timed out/exhausted its practical route. Stage B processed the available files:
10/20 cities completed, 10/20 were artifact candidates (50%), 72 searches, zero retries and zero direct reads.
The 10 complete cities passed schema/materialization/persistence/API round-trip; the incomplete cities failed
closed. This is an incomplete delegated-collection failure, not source-quality or coefficient evidence. Experiment
012 is immutable. That historical next action was completed by Phase 7G below; experiment 013 is now the latest
immutable failed result and Phase 8 remains blocked.

#### Phase 7F — resumable collection lifecycle — **complete 12 August 2026**

- Added independent per-city/source inventory of raw responses, telemetry, schema/identity/limit validity,
  reusable pairs, terminal errors, pending slots and orphan evidence.
- Reworked finalization so a missing sibling file never erases successful source evidence. New experiments refuse
  to write immutable results until all registered call slots are terminal; ordinary absence remains pending, while
  an explicit provider error remains distinguishable from `not_found`.
- Expanded canary reporting for registered/terminal/pending slots, raw/telemetry presence, actual calls versus
  assignment attempts, orphans, source/category/grade distributions, all-prior cities and provenance equality.
- Added regression fixtures for Lisbon/Prague partial pairs, Colombo/Dubai raw-only evidence, absent cities and
  invalid responses surrounded by valid calls. Experiments 010, 011 and 012 remain unchanged and immutable.

#### Phase 7G — experiment 013 result — **failed and immutable 12 August 2026**

- Reused 32 validated experiment-012 calls and collected the 28 pending registered slots.
- Reached 60/60 terminal slots, with 58 reusable and two invalid Prague source calls; no raw/telemetry orphan remains.
- Recorded 19/20 complete source contracts, 20/20 deterministic 19-tier bundles and persistence/API provenance
  equality, zero artifact candidates and zero all-prior cities.
- Recorded 62 actual provider calls, 11 assignment attempts, two retries and zero direct reads. The standard result
  reports 167 searches; the incident record adds four discarded-attempt Prague searches, for 171 actual searches.
- Numbeo's corrected contract worked: cappuccino and domestic beer were each observed in 19/20 responses.

The duplicate happened when a parallel spawn command returned a thread-limit error after one Prague agent had
already started; a later explicit assignment repeated BYT and Numbeo. The surviving raw evidence remains, the two
slots were deliberately invalidated, and `collection-incidents.json` discloses the overwritten first-attempt evidence.
The result is not restated as a pass.

The run also exposed that `evaluateV61CanaryBatch` sets batch pass to `problems.length === 0`. That is stricter than
the registered 19/20 gate and makes its one-city tolerance unreachable whenever the incomplete city has a diagnostic.
Do not silently change or rescore 013. Phase 7H is complete: new experiments reserve city/source slots with an
exclusive write-once claim, the evaluator separates per-city diagnostics from batch-fatal contract violations, and
regressions cover duplicate assignment and the 19/20 tolerance. The next gated action is one new immutable canary
reusing 58 valid 013 calls plus two fresh Prague calls. Phase 8 remains blocked.

## 5. Why the migration is staged

The 25-city preview found 82 of 450 non-zero city/tier comparisons above 2× or below 0.5× v1. In
particular, `food_high_end` is above 2× in 18/25. Representative basket median changes are +36.65%
budget, +11.53% mid-range and +31.90% high-end.

This is not proof of v6.1 error—v1 was never ground truth—but it is a material product discontinuity. Do
not tune v6.1 to v1. Use the staged 121-city report to expose the operational impact, category/region
fallback concentration, ordering and extreme values before owner approval.

## 6. Work sequence

Follow `docs/dev/plans/city-cost-methodology-v6-1.md` from the first incomplete phase:

1. **Phase 6:** contract/document reconciliation and validator assertion — **complete and pushed**.
2. **Phase 7A:** repair search-enabled production collection, date handling and canary evaluator — **complete in current Phase 7A commit**.
3. **Phase 7B:** fresh delegated 20-city operational canary — **failed 17/20; immutable history**.
4. **Phase 7F:** resumable collection lifecycle repair — **complete in `511837f`**.
5. **Phase 7G:** resumable experiment 013 — **immutable failed result at 19/20**.
6. **Phase 7H:** write-once assignment/evaluator repair — **complete; focused tests and full baseline passed**.
7. **Phase 7C:** small user-key provider transport/database/API smoke — before cutover, not before staging.
8. **Phase 8:** resumable/idempotent migration tooling and canary dry run — **blocked after Phase 7G; requires fresh canary**.
9. **Phase 9:** fixed batches across the frozen 121-city frame, producing a staged CSV and provenance
sidecar only.
10. **Phase 10:** complete operational-impact report; then stop for owner review.
11. **Phase 11:** only after approval and Phase 7C, atomically replace the CSV, update the seed source label and switch
   the new-city default as one rollback unit.

**Sequence correction:** Phases 7B, 7E and 7G are immutable failed canary history. Phase 7H is complete; Phase 8
remains blocked after 013's recorded failure until a fresh canary passes. The user-key smoke remains Phase 7C's
external pre-cutover check; it is not authorization to bypass the failed delegated canary.

Update this handoff after every phase with completed evidence and the exact next command/file. Commit and
push each phase and each bulk collection batch.

## 7. Migration protocol requirements

Use `data/reference/v6/migration-v6-1/` for the frozen protocol and artifacts. It must contain the input
CSV hash, city frame, source/reference window, FX snapshot, unedited raw responses, per-call telemetry,
checkpoint ledger, normalized bundles, deterministic materializations, staged CSV, provenance sidecar and
impact report. The tooling must also provide a deterministic seed/import path that creates v6.1
`city_estimates` records and links `cities.estimation_id`; a sidecar that is never exposed by the runtime
does not satisfy the provenance contract for existing cities.

The migration must be:

- **resumable:** never recollect a completed valid call after interruption;
- **idempotent:** rerunning Stage B reproduces byte-identical artifacts;
- **fail closed:** source absence is explicit; only the materializer applies regional/global fallback;
- **atomic:** bulk work never writes the live CSV;
- **auditable:** every row records collection mode, reuse, retries, searches, missingness and provenance;
- **coherent:** one FX snapshot and declared source window; no silent mixing of stale and fresh responses.

Existing experiment 003/006 calls may be reused only after schema and window validation. If all 25 cities
qualify, the remaining collection is 288 primary calls; without reuse the upper bound is 363. Total search
ceiling for 121 cities is 1,210. Report actual values, including retries and reuses.

Provider mode is required for the Phase 7 runtime claim. For Phase 9, delegated Stage-A responses are
permitted only under the exact production prompts/schema and experiment-006 discipline if credentials are
unavailable. Stage B must always call the shipped `materializeCityCostV61` implementation.

## 8. What not to do

- Do not open, read, score, freeze or replace a holdout.
- Do not refit accommodation or tune coefficients to resemble v1.
- Do not add a fourth call, exceed ten searches per city or use production direct-page reads.
- Do not derive priors from either the current or staged CSV.
- Do not hand-edit generated JSON, priors, reports, materializations or CSV rows.
- Do not overwrite the live CSV before Phase 10 owner review.
- Do not enable v6.1 globally before the coordinated cutover.
- Do not stop for individual outliers; use the batch rule. Stop if candidates exceed 30% of a batch.

## 9. Verification

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
node scripts/test-v6-1-canary-assignment.mjs
```

Add migration-specific checks when Phase 8 creates them. Rerun a failed full test suite once before
investigating because the OneDrive checkout has a known transient temp-directory failure.

## 10. Current stopping point — Phase 7H complete; fresh canary next

Experiment 013 is complete, failed and immutable. Phase 7H has passed its focused and full verification baselines.
The exact next action is owner-authorize and run one fresh immutable canary reusing 58 valid experiment-013 calls and
recollecting only Prague BYT/Numbeo. Do not rerun or mutate 013, read a holdout, stage migration or touch the live CSV.
At the eventual Phase 10 boundary, stop again for owner approval before Phase 11 cutover.
