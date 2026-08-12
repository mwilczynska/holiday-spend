# Handoff — City Cost Methodology v6.1

**As at:** 12 August 2026

**Branch:** `feat/city-cost-methodology-v6`

**Phase 6 completed commit:** `07a1c0a`
**Phase 7 canary result commit:** `1bc352f`
**Phase 7 canary result:** failed and recorded in `010-v6-1-runtime-canary`

**Milestone:** M4 coherent migration of the 121-city library — **owner approved, not started**
**Exact next action:** configure a real server-side provider credential, then rerun
`node scripts/run-v6-1-runtime-canary.mjs` against the unchanged registration. Do not begin Phase 8 or
bulk migration until the canary reaches at least 19/20 complete cities and verifies provenance round-trip.

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
- the Phase 7 canary registration and real-provider attempt;
- the full verification baseline, clean branch and pushed Phase 7 result commit.

Current production state:

- the live 121-city CSV is still v1 and must remain unchanged until Phase 11 approval;
- the feature flag is opt-in and flag-off remains v1;
- the real-provider canary has measured 0/20 complete cities against the ≥95% clause because no
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` was configured; this is a failed gate, not a
  fixture result;
- no bulk migration responses or staged CSV exist yet;
- all holdouts are spent/closed and irrelevant to the operational migration.

## 4. Phase 6 result and remaining release issue

The generated authority and release declarations drifted during FX regeneration. Phase 6 resolved the drift:

- `data/reference/v6/coefficients-v6.json`: cocktail/cappuccino `k=2.4838`, n=14, grade C, ±64%;
- `data/reference/v6/validation-manifest-v6-1.json`: schema v3 now declares `k=2.4838`, grade C, ±64%;
- the validator compares the manifest key, source anchor, value, grade, interval, authority and relation text
  with the generated coefficient;
- the negative regression with the old `2.6`, ±75% declaration failed as required;
- generated release and rollout reports now describe the approved staged migration sequence.

Accommodation coefficients and the Expedia/Booking offset did not change. The remaining unmeasured release
item is the live provider-path coverage clause. Phase 7 must measure it; fixture replay or delegated
collection cannot establish it.

## 4a. Phase 7 canary result — stopped

`data/reference/v6/experiments/010-v6-1-runtime-canary/` is preregistered for 20 cities with the frozen
CSV/FX/prompt hashes and ran `generateCityCostEstimate` with `CITY_COST_METHODOLOGY_V6=true`. The result is
**0/20 complete**, required **19/20**. All cities failed closed before a source call because this checkout
has no configured provider credential. The result records the exact missing-key error for every city;
there were no fixture, delegated or v1 substitutions, no holdout reads, and no CSV writes.

This is the registered canary stop rule. Phase 8 is blocked until an owner supplies/configures a real
provider credential and the same frozen canary is rerun. Do not weaken the threshold or reinterpret the
failed run as runtime coverage.

## 5. Why the migration is staged

The 25-city preview found 81 of 450 non-zero city/tier comparisons above 2× or below 0.5× v1. In
particular, `food_high_end` is above 2× in 18/25. Representative basket median changes are +36.65%
budget, +11.53% mid-range and +31.90% high-end.

This is not proof of v6.1 error—v1 was never ground truth—but it is a material product discontinuity. Do
not tune v6.1 to v1. Use the staged 121-city report to expose the operational impact, category/region
fallback concentration, ordering and extreme values before owner approval.

## 6. Work sequence

Follow `docs/dev/plans/city-cost-methodology-v6-1.md` from the first incomplete phase:

1. **Phase 6:** contract/document reconciliation and validator assertion — **complete and pushed**.
2. **Phase 7:** real-provider canary — **failed 0/20; stopped pending provider credential**.
3. **Phase 8:** resumable/idempotent migration tooling and canary dry run.
4. **Phase 9:** fixed batches across the frozen 121-city frame, producing a staged CSV and provenance
sidecar only.
5. **Phase 10:** complete operational-impact report; then stop for owner review.
6. **Phase 11:** only after approval, atomically replace the CSV, update the seed source label and switch
   the new-city default as one rollback unit.

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
node scripts/run-v6-1-runtime-canary.mjs --check
```

Add migration-specific checks when Phase 8 creates them. Rerun a failed full test suite once before
investigating because the OneDrive checkout has a known transient temp-directory failure.

## 10. Current stopping point

The workstream is stopped after the failed Phase 7 canary. Configure a real server-side provider credential
and rerun the exact registered command before starting Phase 8. At the end of Phase 10, stop for owner
approval. Touching the live CSV before that approval is outside authority even though the eventual migration
itself is approved.
