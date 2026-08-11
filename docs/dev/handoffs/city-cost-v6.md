# Handoff — City Cost Methodology v6.1

**As at:** 10 August 2026
**Branch:** `feat/city-cost-methodology-v6`
**Milestone:** v6.1 implementation — **Phase 3 complete**
**Exact next phase:** reachable release checks and the generated 19-tier report

This handoff is written for a cold GPT-5.6 Luna Max context. It supersedes the earlier M3 handoffs. The
v6.0 evidence and commits remain valid history; do not reconstruct the workstream from old prompts.

## 1. Read in this order

1. This file.
2. `docs/dev/plans/city-cost-methodology-v6-1.md`.
3. `data/reference/v6/validation-manifest-v6-1.json`.
4. `LOOP-PROMPT-V6.md`.
5. The three v6.1 prompts in `docs/prompts/`.
6. `data/reference/v6/README.md`.
7. `PLAN.md`.
8. `CLAUDE.md`.

Do not bulk-read `data/reference/v5/experiments/`. Do not read any holdout ledger or score values.

## 2. Owner decision

The v6.0 all-tier validation programme is stopped. It violated the original simplicity goal by treating
behavioural presets as 19 independently observable city prices.

The owner has approved this replacement:

- keep all 19 existing food, drink, activity and accommodation tiers;
- use three source calls and deterministic modelling;
- use BYT's source-native daily food and activity tiers;
- use Numbeo only for cappuccino and domestic beer;
- keep Expedia 3-star plus the existing accommodation ladder;
- model street food and cocktail explicitly;
- use one category-tier fallback layer;
- ship for new cities behind the existing flag;
- keep the 121-city CSV unchanged;
- collect and read no further holdout.

Food/activity source dependence and drink-preset assumptions are completed evidence states, not blockers.

## 3. Why v6.0 stopped

The v6.0 production skeleton worked, but the evidence programme became unreachable:

- 25/25 cities materialized through the real path;
- accommodation genuinely scored 8.27%–25.46% median APE;
- only 9/19 tiers were evaluable in development;
- one tier was definitional, eight blocked and one not evaluable;
- Gates 3–6 could not be evaluated without an independent full daily-spend basket;
- the 25 × 18 development ledger contained 450 slots: 280 found, 164 not_found and 6 class_absent;
- the fresh holdout extension found only 12/180 rows and was spent without paired predictions;
- a third holdout proposal would repeat the same failure and is cancelled for v6.1.

The v6.0 runtime still has multiple fallback layers and routes BYT daily-spend values through ticket-shaped
anchor names, so it remains historical. v6.1 now has an isolated source boundary in
`src/lib/city-cost-v6-1-collection.ts`, the deterministic materializer in
`src/lib/city-cost-methodology-v6-1.ts`, generated priors in `data/reference/v6/priors-v6-1.json`, and a
25-city replay under `data/reference/v6/experiments/008-v6-1-development-fixtures/`. The feature flag now
uses this v6.1 path; the 121-city CSV and flag-off v1 path are unchanged.

## 4. What is banked

Do not revisit:

- Expedia 3-star extraction and calibration;
- Booking ground truth and accommodation selection rules;
- accommodation coefficients, private rollback and dorm refit;
- spent holdout integrity and disclosures;
- v6.0 development fixtures;
- grade/provenance persistence and UI;
- missingness states and fail-closed collection;
- v1 rollback path;
- priors decoupled from the live CSV.

Banked accommodation development median APE:

| Tier | Median APE |
| --- | ---: |
| 3-star | 8.27% |
| 4-star | 13.12% |
| private hostel | 15.97% |
| 2-star | 16.74% |
| 1-star | 21.49% |
| dorm | 25.46% |

## 5. Target production path

| Call | Source facts | Product use |
| --- | --- | --- |
| Expedia | 3-star room for two | six accommodation tiers through banked ladder |
| BYT | food budget/mid/high and activities budget/mid/high, per person/day | two-person daily food/activity tiers |
| Numbeo | cappuccino and domestic beer | five drink presets |

At most **3 calls / 10 searches / 0 direct page reads** per city.

### Food

- `food_budget = 2 × BYT food budget`
- `food_mid_range = 2 × BYT food mid`
- `food_high_end = 2 × BYT food high`
- `food_street_food = 0.5331 × food_budget`, generated compatibility model, grade D ±45%

### Drinks

Keep the five current fields and formulas. Cocktail remains `2.6 × cappuccino`, grade C ±75%.
Wine and McMeal are not production inputs.

### Activities

- free = 0
- budget/mid/high = two times the matching BYT per-person daily tier

Use semantically correct BYT daily-spend anchor names internally.

### Fallback

One layer:

`direct category tier vector → regional category tier vector → global category tier vector`.

No anchor-prior → relation → basket → direct-tier-prior overwrite chain in v6.1.

## 6. Existing evidence to reuse

No new LLM calls are needed for implementation:

- `data/reference/v6/experiments/006-development-prediction-spine/`
  - reuse Expedia and Numbeo cappuccino/beer;
  - use BYT activity records as a cross-check.
- `data/reference/v6/experiments/003-budgetyourtrip-tier-panel/`
  - reuse BYT food and activity daily tiers as v6.1 source fixtures.
- `data/reference/v6/ground-truth/development-ledger.json`
  - read only through existing scripts for banked accommodation checks;
  - item-level food/activity rows are historical and not v6.1 truth.

Once experiment 003 supplies production fixtures, it is no longer food ground truth. Do not score BYT
against itself.

## 7. Exact next action

Start Phase 4 from `LOOP-PROMPT-V6.md`:

1. Add `scripts/validate-city-cost-v6-1-release.mjs` for the active v6.1 manifest.
2. Validate 25/25 materialized cities × 19 tiers, finite/non-negative values, monotonicity, complete
   provenance and category fallback disclosure.
3. Confirm the three-call/10-search/zero-direct-read economics from the normalized fixture replay.
4. Carry forward the six banked accommodation APE results without refitting or reopening holdouts.
5. Produce `data/reference/v6/v6-1-development-release-report.md`, including all 19 tiers, source/grade
   policy, fallback rates, source dependence and the informational v1 comparison.
6. Add release-validator and report commands to the verification baseline, run it, commit and push.
7. Continue to Phase 5 integration/rollback documentation unless a stop condition applies.

Do not begin by changing coefficients, priors or the materializer. The response contract comes first.

## 8. Implementation sequence

1. Source schemas and prompt wiring — **complete** in `src/lib/city-cost-v6-1-collection.ts`.
2. Simplified v6.1 materializer — **complete** in `src/lib/city-cost-methodology-v6-1.ts`.
3. Generated category priors and 25-city fixtures — **complete** from existing experiments 003/006.
4. Reachable release validator/report — **next**.
5. New-city feature-flag integration — **complete**; rollback and release documentation remain.

Commit and push after each phase. Rewrite §3 and §7 of this handoff with actual completed state and the
next exact action.

## 9. Stop conditions

Stop for owner input only if work would require:

- a fourth source call;
- new model/browser collection;
- reading or creating a holdout;
- touching the 121-city CSV;
- removing a product tier;
- refitting accommodation;
- changing the approved source map.

Do not stop for missing fields, grade D, weak regional coverage, lack of independent food/drink/activity
truth, or individual outliers. Apply category fallback and continue.

## 10. Required generated tooling

Create during the named phases:

- `scripts/build-city-cost-v6-1-priors.mjs` with `--check`;
- `scripts/materialize-city-cost-v6-1-development.mjs` with `--check`;
- `scripts/validate-city-cost-v6-1-release.mjs`;
- a generated 19-tier v6.1 release report;
- tests proving formulas, grades, fallback and v1 rollback.

Generated coefficients and priors are never hand-edited.

## 11. Verification

Run after every phase:

```
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
node scripts/fit-city-cost-ladder-v6.mjs --check
node scripts/test-city-cost-v6-ground-truth-warnings.mjs
node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete
```

Final baseline also includes:

```
node scripts/build-city-cost-v6-1-priors.mjs --check
node scripts/materialize-city-cost-v6-1-development.mjs --check
node scripts/validate-city-cost-v6-1-release.mjs
```

The expected Next build notice for `/api/export` is not a failure. Rerun a failing test suite once
before investigation because OneDrive intermittently flakes in temporary directories.

## 12. Finish line

v6.1 is done when all 19 tiers materialize for 25/25 fixtures with grades/provenance, the three-call
new-city path passes, category fallback is explicit, all reachable release gates report cleanly, the v1
rollback still works, the 121-city CSV is untouched, no holdout was read, and the branch is clean and pushed.
