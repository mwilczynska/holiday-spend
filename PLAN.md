# City Cost v1.1 — Restore the Simple, Effective Method

**Status:** Phase 2 in progress

**Current phase:** Phase 2 — create the clean v1.1 product branch

**Branch:** `feat/city-cost-methodology-v1-1` (clean `main`-based product implementation)

**Last updated:** 18 August 2026

**Latest commit:** `05fc9a4` — clean branch created from `main`; foundation changes are ready to commit.

**Exact next action:** Commit and push the clean-branch foundation, then implement and test the formula-preserving
v1.1 anchor schema/materializer without changing the frozen v1 prompt or live CSV.

## Decision summary

v6.1 research is complete but is not accepted for product cutover. The staged v6.1 CSV will not replace the live
dataset, Phase 11 is cancelled, and the v6.1 generation path will not remain an executable product option.

The live 121-city v1 CSV remains unchanged. A clean v1.1 product branch will be created from `main`. v1.1 will keep
v1's anchor definitions and formulas exactly, but the LLM will return anchors only; deterministic server code will
perform the formulas and USD→AUD conversion. v1.1 will become the default for newly generated cities only after its
tests and functional smoke pass. Existing cities will not be bulk-migrated.

The lived-spending benchmark previously proposed as recommendation 4 is explicitly out of scope. No new collection,
holdout, coefficient fitting, accommodation refit, or existing-city migration is authorized by this plan.

## Plan maintenance rule

This file is the canonical progress artifact.

- Update `PLAN.md` whenever a task starts or finishes, and before every commit and push.
- Mark pending tasks `[ ]` and verified completed tasks `[x]`.
- Label every phase `TO DO`, `IN PROGRESS`, or `COMPLETE`.
- Keep at most one phase `IN PROGRESS`.
- Update the current phase, exact next action, date, branch, and latest commit at every checkpoint.
- Never mark a task complete before its required verification passes.
- Preserve superseded decisions as dated history rather than deleting them.

## Phase 0 — Preserve history and initialize the new plan — COMPLETE

- [x] Copy the previous root `PLAN.md` to `docs/dev/archive/plans/PLAN-city-cost-v6-1-final-2026-08-18.md`.
- [x] Add a `SUPERSEDED — not current` banner to the archived plan.
- [x] Replace root `PLAN.md` with this tracked v1.1 checklist.
- [x] Record the v6.1 retirement decision in `LOG.md` and `docs/dev/handoffs/city-cost-v6.md`.
- [x] Mark the active v6.1 plan, handoff, loop prompt, and release recommendation as superseded or abandoned.
- [x] Run `npm run docs:sync-memory` and `npm run docs:check-memory`.
- [x] Verify the archived plan is complete and unchanged apart from its banner.
- [x] Commit and push the planning transition (`2d74c0b`).

## Phase 1 — Close v6.1 without erasing it — COMPLETE

- [x] Mark v6.1 research complete but rejected for product cutover.
- [x] Cancel Phase 11 permanently.
- [x] Record that the staged v6.1 CSV must never replace the live CSV.
- [x] Preserve all v5/v6 experiments, holdouts, staged artifacts, and historical conclusions unchanged.
- [x] Confirm the live CSV and default v1 path remain untouched.
- [x] Commit and push the final v6 documentation state.
- [x] Create and push the annotated tag `city-cost-v6.1-research-final-2026-08-18`.
- [x] Record the tag and final commit in this plan (`335e61b`).
- [x] Perform no further implementation work on the archived v6 branch.

## Phase 2 — Create the clean v1.1 product branch — IN PROGRESS

- [x] Create `feat/city-cost-methodology-v1-1` from `main`.
- [x] Carry across only this plan, the archived prior plan, and a concise v6 retrospective.
- [x] Record the live 121-city CSV hash as an invariant: `63b13a8774c66999c5f99aade671ca357f65b949`.
- [x] Add a guard proving v1.1 tooling cannot write or regenerate the live CSV.
- [x] Selectively port live provider/model discovery.
- [x] Selectively port provider-specific reasoning effort, including `max` where supported.
- [x] Preserve browser-only API-key handling.
- [ ] Selectively port generic persistence/API provenance helpers.
- [ ] Selectively port deterministic country identity handling.
- [x] Do not import v5/v6 experiment data, source collectors, canaries, migration tooling, fitting scripts, or release validators.
- [x] Run the baseline inherited from `main` (typecheck, build, 144 tests, memory check).
- [ ] Commit and push the clean v1.1 foundation.

## Phase 3 — Implement formula-preserving v1.1 — TO DO

- [ ] Preserve `llm_prompt_new_cities_1.md` unchanged as the exact v1 rollback prompt.
- [ ] Add a versioned v1.1 prompt requesting only the existing ten USD anchors, region, confidence, and comparable-city reasoning.
- [ ] State honestly that values are holistic model estimates; do not claim live page inspection.
- [ ] Exclude derived tiers and currency conversion from the model response.
- [ ] Add a strict `CityCostV11AnchorResponse` schema requiring all ten anchors to be finite and positive.
- [ ] Implement pure `materializeCityCostV11`.
- [ ] Copy every current v1 formula exactly, including `accom_4_star = hotel_3star_2p × 1.80`.
- [ ] Preserve every current planner field and direct drink input.
- [ ] Perform arithmetic before currency conversion.
- [ ] Round final daily/accommodation values to whole AUD and direct drink inputs to cents.
- [ ] Load USD→AUD from the checked-in, source-attributed FX snapshot.
- [ ] Persist FX snapshot ID, hash, rate, and as-of date.
- [ ] Ensure the LLM never supplies or infers FX.
- [ ] Use requested city identity plus canonical country metadata for v1.1.
- [ ] Eliminate the separate metadata LLM call for v1.1.
- [ ] Prove a genuinely new v1.1 city uses exactly one LLM call.
- [ ] Fail without partial persistence on invalid anchors, unsupported country, missing FX, or provider failure.
- [ ] Add deterministic formula and schema tests.
- [ ] Commit and push the v1.1 materializer.

## Phase 4 — Persistence, API, and UI integration — TO DO

- [ ] Add `methodologyVersion: "v1.1"`.
- [ ] Add estimate source `llm_city_generation_v1_1`.
- [ ] Persist anchors, provider, model, reasoning effort, prompt version, formula version, FX provenance, request context, and confidence notes.
- [ ] Persist `evidenceBasis: "holistic_model_estimate"`.
- [ ] Do not fabricate source observations, evidence grades, or statistical intervals.
- [ ] Add generic methodology provenance to `/api/estimates`.
- [ ] Display v1.1 methodology, anchors, model, reasoning, and FX provenance on `/dataset`.
- [ ] Preserve historical v1, v6.0, and v6.1 record readability without retaining an executable v6 generator.
- [ ] Add `CITY_COST_METHODOLOGY_VERSION=v1|v1.1`.
- [ ] Preserve exact legacy v1 generation when explicitly set to `v1`.
- [ ] Make `CITY_COST_METHODOLOGY_V6=true` produce a clear configuration error and never activate v6.1.
- [ ] Keep v1 as the temporary default until Phase 5 passes.
- [ ] Add persistence, API, UI, selector, and rollback regressions.
- [ ] Commit and push the integration phase.

## Phase 5 — Verify and activate v1.1 for new cities — TO DO

- [ ] Prove formula parity for identical anchors and FX.
- [ ] Test all formula and rounding boundaries.
- [ ] Prove v1.1 makes one provider call and no metadata or search call.
- [ ] Prove failed generation leaves no partial city or estimate.
- [ ] Prove explicit `v1` still runs the historical prompt and path.
- [ ] Prove historical v6 records remain readable.
- [ ] Prove the live CSV hash and all 121 rows remain unchanged.
- [ ] Run a user-key functional smoke for Tottori, Toowoomba, and Brno.
- [ ] Verify each smoke city has ten positive anchors, deterministic tiers, one LLM call, and complete API provenance.
- [ ] Treat the smoke as operational validation only, not an accuracy benchmark.
- [ ] Make v1.1 the default for newly generated cities after the smoke passes.
- [ ] Keep `CITY_COST_METHODOLOGY_VERSION=v1` as the immediate rollback.
- [ ] Regenerate no existing city automatically.
- [ ] Run TypeScript, build, tests, documentation checks, and the deterministic v1.1 check.
- [ ] Commit and push the v1.1 activation.

## Phase 6 — Final archival and bloat removal — TO DO

- [ ] Make the v1.1 plan, handoff, and loop the only active city-cost workstream documents.
- [ ] Confirm no v5/v6 experiment corpus or migration artifact entered the clean product branch.
- [ ] Retain only a concise summary of useful v6 findings and links to the archived branch/tag.
- [ ] Preserve generic model discovery, reasoning controls, country identity, and persistence improvements.
- [ ] Remove active references to v6 activation, Phase 11, staged migration, and pending holdouts.
- [ ] Reduce the active verification baseline to shipping product checks and deterministic v1.1 checks.
- [ ] Preserve the archived v6 branch and tag indefinitely.
- [ ] Run the complete final baseline.
- [ ] Confirm the branch is clean and pushed.
- [ ] Mark this plan complete.

## Definition of Done

- [ ] The existing 121-city v1 CSV is unchanged.
- [ ] v6.1 cannot be activated in the product.
- [ ] v6.1 history remains available through its branch and immutable tag.
- [ ] New cities default to one-call v1.1 generation.
- [ ] v1.1 uses the exact v1 formulas with deterministic server-side arithmetic and FX.
- [ ] Explicit v1 rollback remains operational.
- [ ] All current planner fields remain supported.
- [ ] Provider, model, reasoning, anchors, formula, and FX provenance survive persistence and API/UI display.
- [ ] No holdout, new methodology collection, lived-spending benchmark, coefficient change, or existing-city migration occurred.
- [ ] The active product branch contains none of the v5/v6 experiment bloat.
