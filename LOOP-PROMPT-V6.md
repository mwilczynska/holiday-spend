# LOOP-PROMPT-V6 — v6.1 reachable finish line

This is the active autonomous implementation prompt for city cost methodology v6.1. The earlier v6.0
loop is superseded because its all-19 independent-validation Definition of Done was structurally
unreachable. Git history and the v6.0 evidence preserve that record.

## PROMPT

Copy everything below this line to GPT-5.6 Luna Max.

---

Resume the city cost methodology workstream on branch `feat/city-cost-methodology-v6`.

You are implementing the owner-approved **v6.1 simplification**. Keep all 19 existing product tiers.
Do not restart evidence collection and do not attempt to independently validate every behavioural preset.
The finish line is a simple, source-native, honestly graded three-call path for new cities.

## 0. Read before acting

Read these completely, in this order:

1. `docs/dev/handoffs/city-cost-v6.md` — cold-start state and exact first action
2. `docs/dev/plans/city-cost-methodology-v6-1.md` — active design and implementation phases
3. `data/reference/v6/validation-manifest-v6-1.json` — reachable release gates
4. The three v6.1 prompts:
   - `docs/prompts/llm_prompt_city_cost_v6_1_expedia_3star.md`
   - `docs/prompts/llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md`
   - `docs/prompts/llm_prompt_city_cost_v6_1_numbeo_drinks.md`
5. `data/reference/v6/README.md` — evidence inventory
6. `PLAN.md` — milestone state
7. `CLAUDE.md` — canonical project memory

Then inspect only the implementation files needed for the current phase:

- `src/lib/city-cost-v6-collection.ts`
- `src/lib/city-cost-methodology-v6.ts`
- `src/lib/city-generation.ts`
- `scripts/generate-v6-prediction-bundle.mjs`
- `data/reference/v6/experiments/003-budgetyourtrip-tier-panel/`
- `data/reference/v6/experiments/006-development-prediction-spine/`

Do not bulk-read `data/reference/v5/experiments/`. Do not read any holdout ledger or score values.

Verify:

- branch is `feat/city-cost-methodology-v6`;
- worktree state before editing;
- `npm run docs:check-memory` passes.

Preserve unrelated user changes if the worktree is dirty.

## 1. Product decisions — settled, do not reopen

1. Keep all 19 existing planner fields: accommodation 6, food 4, drinks 5, activities 4.
2. Production uses exactly three source calls:
   - Expedia 3-star accommodation;
   - BudgetYourTrip food and activity budget/mid/high daily tiers;
   - Numbeo cappuccino and domestic beer.
3. BYT food/activity values are source-backed per-person daily spend, multiplied by two in code.
4. `food_street_food` remains as a modelled compatibility tier.
5. Drinks remain explicit consumption presets. Cocktail stays modelled; wine stays excluded.
6. Food/activity source dependence is an honest completed outcome, not a blocker.
7. No new holdout is collected or read.
8. v6.1 is for new-city generation behind the existing feature flag. The 121-city CSV stays unchanged.

If implementation details offer several equivalent choices, choose the smallest change that satisfies the
v6.1 plan and preserves historical v6.0 replay.

## 2. What is already solved

Do not revisit:

- Expedia-to-Booking calibration;
- accommodation coefficients or ground-truth collection;
- the private rollback or dorm refit;
- v6.0 holdout reporting;
- grades/provenance UI;
- provider adapters;
- the v1 flag-off path.

The genuine accommodation development median APEs are:

- 3-star 8.27%
- 4-star 13.12%
- private hostel 15.97%
- 2-star 16.74%
- 1-star 21.49%
- dorm 25.46%

The v6.0 generator already materializes 25/25 cities. Preserve this evidence; v6.1 simplifies the source
and fallback semantics around it.

## 3. Phase 1 — v6.1 response contracts

Implement `city-cost-v6-1-spine-response-v1` validation in
`src/lib/city-cost-v6-collection.ts` or a focused sibling module.

Required source measures:

- Expedia: `hotel_3star_room_2p`
- BYT:
  - `byt_food_budget_per_person_day`
  - `byt_food_mid_per_person_day`
  - `byt_food_high_per_person_day`
  - `byt_activities_budget_per_person_day`
  - `byt_activities_mid_per_person_day`
  - `byt_activities_high_per_person_day`
- Numbeo:
  - `cappuccino_1`
  - `domestic_draft_beer_1`

Requirements:

- validate exact city/source/schema/measure keys;
- retain source currency, URL, title, evidence text, query and tax status;
- preserve `not_found` / `blocked` / `stale` / `class_absent`;
- enforce source search limits and `directPageReads === 0`;
- keep v6.0 parsers for stored responses;
- use the v6.1 prompts for new runtime calls.

Add focused tests before moving on. Commit and push:

`feat: add v6.1 source-native spine contracts`

## 4. Phase 2 — simplify deterministic materialization

Add a v6.1 materialization path using the shared production library. Do not reimplement FX or provenance.

### Accommodation

Keep the current calibrated Expedia anchor and ladder unchanged.

### Food

- `food_budget = 2 × byt_food_budget_per_person_day`
- `food_mid_range = 2 × byt_food_mid_per_person_day`
- `food_high_end = 2 × byt_food_high_per_person_day`
- `food_street_food = 0.5331 × food_budget`

Generate `0.5331` through the coefficient script from
`(6 × 0.2757) / (4 × 0.2757 + 2)`; never hand-edit generated JSON. Grade street food D ±45%.

### Drinks

- `drink_coffee = cappuccino`
- `drinks_none = 2 cappuccinos`
- `drinks_light = 2 cappuccinos + 2 beers`
- `drinks_moderate = 2 cappuccinos + 4 beers + 2 cocktails`
- `drinks_heavy = 2 cappuccinos + 6 beers + 4 cocktails`
- `cocktail = 2.6 × cappuccino`, grade C ±75%
- no wine

### Activities

- `activities_free = 0`
- remaining tiers are two times the matching BYT per-person daily tier

Do not store BYT daily spend in ticket-shaped anchor names. Normalize old v6.0 fields only at the legacy
boundary.

### Fallback

Use one fallback layer per category:

`direct source tier vector → region tier vector → global tier vector`.

Remove the v6.1 path's anchor-prior → generated-anchor → basket → direct-tier-prior overwrite chain.
Accommodation remains the only anchor ladder.

Intervals use the widest contributing source/relation interval. Do not use quadrature for behavioural
presets.

Add tests covering all 19 formulas, grades, missing-category fallback, monotonicity and provenance.
Commit and push:

`feat: simplify v6.1 tier materialization`

## 5. Phase 3 — generated priors and development fixtures

Use existing data only; make zero LLM calls.

Build normalized v6.1 fixtures for the same 25 development cities:

- Expedia and Numbeo drink facts from experiment 006;
- BYT food/activity facts from experiment 003;
- experiment 006 BYT activity facts as a schema/provenance cross-check.

Write deterministic scripts that:

1. generate the v6.1 category-tier priors without reading the live CSV;
2. generate 25 normalized spine bundles;
3. materialize the real v6.1 path;
4. support `--check` and reproduce byte-identically.

Do not treat experiment 003 as ground truth after it becomes the v6.1 production fixture source.

Report:

- source observations and explicit missingness;
- grade distribution;
- category fallback rate by region;
- all 19 output coverage;
- calls/searches represented by the source records.

Commit and push:

`feat: build v6.1 development fixtures and priors`

## 6. Phase 4 — reachable release report

Add a deterministic validator/reporter for
`data/reference/v6/validation-manifest-v6-1.json`.

Score only its ten release gates:

1. output coverage;
2. schema and missingness;
3. provenance and grades;
4. algebraic coherence;
5. banked accommodation accuracy;
6. source-dependence disclosure;
7. deterministic replay;
8. refresh economics;
9. integration and rollback;
10. verification.

Produce a 19-row table naming each tier's source/derivation, grade, interval and fallback path.

Food/activity are BYT source-backed, drinks are source-priced presets, and street food is a grade-D
compatibility model. Do not call these independently validated. The old gates 2–6, all-19 v1 comparison
and full-basket city ranking are historical non-gates for v6.1.

Commit and push:

`docs: report reachable v6.1 release gates`

## 7. Phase 5 — integration finish

- Wire new runtime collection to the three v6.1 prompts.
- Keep `CITY_COST_METHODOLOGY_V6=true` as the opt-in new-city switch.
- Keep flag-off v1 behaviour.
- Do not alter `data/reference/city_costs_app_aud.csv`.
- Ensure persisted metadata identifies methodology `v6.1` and retains full provenance.
- Update any methodology UI text that inaccurately describes item-level food or ticket-level activity.
- Rewrite `PLAN.md`, `LOG.md`, this loop's status, the handoff, inventories and project memory.

Commit and push the completed milestone.

## 8. Stop rules

Stop and ask the owner only if completing the approved design would require:

- a new source or fourth production call;
- new LLM/browser collection;
- opening any spent or proposed holdout;
- touching the 121-city CSV;
- removing or renaming a user-facing product tier;
- changing accommodation coefficients;
- a product decision not settled in the v6.1 plan.

Do **not** stop for:

- individual missing source fields;
- low source coverage in a region;
- food/activity lacking independent truth;
- drink baskets lacking independent truth;
- a grade-D result;
- an outlier that does not violate deterministic schema/algebra.

Use the documented fallback and continue.

If the same implementation approach fails three times for the same structural reason, stop that approach.
Do not collect evidence to rescue an implementation defect.

## 9. Guardrails

- No holdout read, score, freeze or collection.
- No new ground-truth collection.
- No v1 CSV modification.
- No accommodation refit.
- No hand-edited generated coefficients or priors.
- No direct source page reads in production.
- No hidden fallback or relabelling modelled values as observed.
- No all-19 independent-validation requirement.
- Preserve v6.0 evidence and stored-response replay.

## 10. Verification baseline

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

Add these during implementation and include them in the final baseline:

```
node scripts/build-city-cost-v6-1-priors.mjs --check
node scripts/materialize-city-cost-v6-1-development.mjs --check
node scripts/validate-city-cost-v6-1-release.mjs
```

If the test suite fails, rerun it once before investigating because this OneDrive checkout has a known
temp-directory flake.

## 11. Definition of Done

Do not stop until every item in §8 of
`docs/dev/plans/city-cost-methodology-v6-1.md` is true, the tree is clean, and the branch is pushed.

The successful final state is:

- all 19 tiers retained;
- three source calls;
- 25/25 deterministic development materializations;
- honest grades and category fallback;
- accommodation accuracy banked;
- food/activity/drinks explicitly source-dependent or modelled;
- new-city path ready behind the flag;
- 121-city CSV untouched;
- no new holdout spent.

At the end of each phase, update `docs/dev/handoffs/city-cost-v6.md` with completed work and the
next exact command/file. A handoff that says only “continue” has failed.

---

Resume line:

> Resume v6.1 on `feat/city-cost-methodology-v6`. Read
> `docs/dev/handoffs/city-cost-v6.md`, then follow `LOOP-PROMPT-V6.md` from the first incomplete
> phase. Keep all 19 tiers, use no new collection or holdout, and do not touch the 121-city CSV.
