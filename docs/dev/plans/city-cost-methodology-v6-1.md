# City Cost Methodology v6.1 — Reachable Finish Line

**Status:** Complete for new-city generation; M4 migration remains a separate future decision
**Owner decision:** 10 August 2026
**Branch:** `feat/city-cost-methodology-v6`

This plan supersedes the all-19 independent-validation objective in
`docs/dev/plans/city-cost-methodology-v6.md`. The v6.0 evidence remains valid and must not be
deleted or rewritten. The production skeleton, accommodation result and provenance work are banked.

## 1. Decision

Keep all **19 existing product fields** and the current planner choices. Simplify what they mean
operationally:

- city-level source values are empirical observations or source proxies;
- food, drink and activity tiers are explicit traveller-spend presets;
- a preset may be modelled where no source publishes it, but it must carry the correct grade;
- independent validation is required only for claims that have an independent observable counterpart;
- lack of an independent spend panel is recorded as source dependence, not treated as unfinished work.

The replacement principle is:

> Measure source-native city/category spending where it is systematically published. Model the remaining
> product presets explicitly. Never present a preset as an observed city price.

## 2. What is banked and must not be revisited

- The three-call extractor/materializer architecture behind `CITY_COST_METHODOLOGY_V6=true`.
- The 25/25 development prediction bundles in experiment 006.
- The 25-city Booking accommodation panel and the spent holdouts. No holdout is reopened.
- Expedia 3-star production extraction and the Expedia-to-Booking multiplier `0.9361`.
- Accommodation results: 3-star 8.27%, 4-star 13.12%, private 15.97%, 2-star 16.74%,
  1-star 21.49%, dorm 25.46% development median APE.
- The accommodation ladder and its current disclosures, including the private rollback.
- A/B/C/D grades, missingness states, provenance persistence and UI display.
- Regional priors decoupled from the live v1 CSV.
- The 121-city CSV remains untouched until a separate migration decision.

## 3. v6.1 production spine — exactly three calls

| Call | Source | Extract | Maximum searches |
| --- | --- | --- | ---: |
| A | Expedia | one 3-star room level for two adults | 4 |
| B | BudgetYourTrip | food budget/mid/high and activity budget/mid/high, all per person/day | 4 |
| C | Numbeo | cappuccino and domestic draft beer only | 2 |

Total: **3 calls and at most 10 searches per city**. Search snippets only, no source account, no direct
page read, no source API and no paid data.

Versioned prompts:

- `docs/prompts/llm_prompt_city_cost_v6_1_expedia_3star.md`
- `docs/prompts/llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md`
- `docs/prompts/llm_prompt_city_cost_v6_1_numbeo_drinks.md`

The old v6.0 prompts remain historical and must continue to parse for stored records. New collection uses
only the v6.1 prompts.

## 4. Derive all 19 product fields

### Accommodation — six fields

Keep the current Expedia 3-star calibration and accommodation ladder unchanged:

1. `accom_shared_hostel_dorm`
2. `accom_hostel_private_room`
3. `accom_1_star`
4. `accom_2_star`
5. `accom_3_star`
6. `accom_4_star`

### Food — four fields

BudgetYourTrip publishes the product-level daily-spend estimand directly. Convert per-person/day to the
two-person product value in deterministic code:

- `food_budget = 2 × byt_food_budget_per_person_day`
- `food_mid_range = 2 × byt_food_mid_per_person_day`
- `food_high_end = 2 × byt_food_high_per_person_day`
- `food_street_food = street_budget_compatibility_k × food_budget`

`street_budget_compatibility_k` is generated, not hand-edited. The default compatibility derivation
preserves the current low-cost basket relationship:

`(6 × 0.2757) / (4 × 0.2757 + 2) = 0.5331`

This is a product compatibility model, not an observed BYT tier. It ships at grade D with ±45% unless a
future independent category-level study replaces it. Do not reopen street-food item collection for v6.1.

### Drinks — five fields

Keep the existing five planner fields and explicit consumption presets:

- `drink_coffee = cappuccino_1`
- `drinks_none = 2 × cappuccino_1`
- `drinks_light = 2 × cappuccino_1 + 2 × domestic_draft_beer_1`
- `drinks_moderate = 2 × cappuccino_1 + 4 × domestic_draft_beer_1 + 2 × cocktail_1`
- `drinks_heavy = 2 × cappuccino_1 + 6 × domestic_draft_beer_1 + 4 × cocktail_1`

Keep the existing generated `cocktail_1 = 2.6 × cappuccino_1` relation and ±75% interval. Wine stays
out. McMeal, inexpensive restaurant, midrange restaurant and premium restaurant are no longer production
spine inputs.

These drink quantities are product presets. Validation concerns extraction/provenance and algebraic
coherence, not whether every traveller consumes that exact basket.

### Activities — four fields

BudgetYourTrip publishes per-person daily entertainment/activity spending:

- `activities_free = 0`
- `activities_budget = 2 × byt_activities_budget_per_person_day`
- `activities_mid_range = 2 × byt_activities_mid_per_person_day`
- `activities_high_end = 2 × byt_activities_high_per_person_day`

Introduce semantically correct internal anchor names. Do not continue placing daily-spend values in fields
named `paid_attraction_adult_1`, `half_day_group_activity_adult_1` or
`full_day_premium_activity_adult_1`. Preserve backward parsing for stored v6.0 responses, but normalize
them at the boundary.

## 5. Grades, intervals and fallback

| Path | Grade | Interval |
| --- | --- | ---: |
| Exact Numbeo drink observation | A | ±10% |
| Expedia 3-star calibrated proxy | B | existing ±41% source interval |
| BYT observed daily tier | B | ±35% |
| Validated accommodation ladder | C | existing coefficient interval |
| Cocktail-derived drink tier | C | ±75% |
| Street-food compatibility tier | D | ±45% |
| Missing category source replaced by regional/global tier prior | D | ±45% |
| `activities_free` | definitional | 0% |

Use the widest contributing source/relation interval for a tier. Do not produce pseudo-precision by
quadrature across behavioural quantities.

There is **one fallback layer per category**:

`observed source tier vector → regional tier vector → global tier vector`.

Do not first impute anchor ingredients and then overwrite the resulting basket with a direct tier prior.
Accommodation is the only retained anchor ladder.

Generate v6.1 priors from successful direct production-source development observations. Never read or
invert `data/reference/city_costs_app_aud.csv`.

## 6. Evidence and validation policy

The spent v6.0 holdouts remain closed. The proposed fresh holdout is cancelled for v6.1. Do not collect,
freeze or reveal another holdout during this implementation.

Use existing evidence only:

- experiment 006 Expedia and Numbeo drink responses;
- experiment 003 BYT food/activity rows;
- experiment 006 BYT activity responses as a schema/provenance cross-check;
- existing accommodation development and one-time holdout results.

Food and activities become BYT source-backed product estimates. BYT therefore ceases to be independent
ground truth for those categories. State that plainly. Drinks remain source-priced presets without an
independent full-basket truth. These are completed, source-dependent fields, not blocked fields.

The active release gates are in
`data/reference/v6/validation-manifest-v6-1.json`. The old v6.0 all-tier gates remain historical and
must not block v6.1.

## 7. Implementation phases

### Phase 1 — contracts and schemas

- Add v6.1 source-response types and validators.
- Add the three prompts and register them in `docs/prompts/README.md`.
- Keep v6.0 response parsing for stored evidence.
- Add semantically correct BYT daily-tier anchor names.

### Phase 2 — deterministic materializer

- Implement the mappings in §4 through the shared production library.
- Remove Numbeo food/McMeal from new collection.
- Remove food ingredient ladders and food direct-tier overwrite logic from the v6.1 path.
- Keep v6.0 materialization available only where required to reproduce historical artifacts.
- Generate coefficients/compatibility constants and priors through scripts; never hand-edit JSON.

### Phase 3 — reuse existing development evidence

- Build v6.1 25-city spine fixtures deterministically from experiments 003 and 006.
- Make zero new LLM calls.
- Materialize all 25 cities through the real v6.1 production path.
- Report source observations, grade-D fallback rate by category and region, and all 19 outputs.

### Phase 4 — reachable release checks — **complete**

- Score `validation-manifest-v6-1.json`.
- Confirm all 19 tiers, provenance, monotonicity, non-negative values and refresh economics.
- Carry forward the genuine accommodation accuracy result.
- Label food/activity as BYT source-backed and drinks as source-priced presets; do not manufacture
  independent accuracy.
- Produce an informational v1 A/B diff for the 25 development cities only. It is not a ground-truth gate.

The generated validator passes all nine reachable gates for the 25 × 19 replay. The report and JSON result
are under `data/reference/v6/`; no holdout was read and the shipping CSV was not modified.

### Phase 5 — release boundary — **complete**

- Keep the 121-city CSV unchanged.
- Keep rollback to v1.
- Make v6.1 ready for **new-city generation only** behind the existing feature flag.
- Update the handoff, plan, log, methodology page and project memory.

The full verification baseline passes. The branch is pushed with the release validator, generated report,
rollback regression test and release-boundary documentation. M4 migration of the 121-city CSV remains out of
scope and requires a separate decision.

## 8. Definition of Done

v6.1 is complete when:

1. All 19 existing product fields materialize for 25/25 development fixtures.
2. Every field carries `evidenceBasis`, grade, interval, source IDs and imputed measures.
3. New collection uses exactly three versioned prompts and at most ten searches per city.
4. Expedia, BYT and Numbeo response schemas fail closed and preserve missingness.
5. Food and activity fields use daily-spend names and semantics internally.
6. There is one fallback layer per category and no v1 CSV inversion.
7. All release gates in `validation-manifest-v6-1.json` are reported.
8. The existing accommodation results are preserved; no holdout is read or rescored.
9. The feature-flagged new-city path runs end to end; the 121-city CSV is unchanged.
10. The verification baseline passes, all work is committed and pushed.

Independent validation of food, drinks and activities is not required for v6.1 completion. Their
source dependence must be disclosed in code-generated provenance and documentation.

## 9. Guardrails

- Do not read or rescore any `revealed_once` holdout measure.
- Do not collect the proposed fresh holdout.
- Do not touch `data/reference/city_costs_app_aud.csv`.
- Do not refit accommodation.
- Do not add a fourth production source call.
- Do not reopen item-level menu, street-food or activity-ticket collection.
- Do not require all 19 behavioural presets to have independent ground truth.
- If a source field is missing, use the explicit category fallback and grade D.
- Commit and push after each phase.
