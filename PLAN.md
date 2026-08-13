# Holiday Spend — Plan

The working document for the current workstream. Confirmed historical results and rejected methodologies
live in [LOG.md](LOG.md). Project memory is in [CLAUDE.md](CLAUDE.md).

**Active workstream:** city cost methodology **v6.1 — coherent 121-city migration**
**Last reviewed:** 12 August 2026
**Branch:** `feat/city-cost-methodology-v6`

---

## Where things stand

The application is feature-complete and stable for planning, tracking, dashboard, saved plans and
comparison. **The shipping city-cost path is still v1** — it asks an LLM for remembered anchors, performs
arithmetic and FX inside the model, and applies asserted multipliers, one of which
(`accom_4_star = hotel_3star × 1.80`) is refuted at 38.8% median absolute error across 16 cities.

**v5 is closed.** It ran 95 experiments and accepted zero product mappings, because its acceptance rule
could not be satisfied from free public sources. Its evidence is retained in full and is the foundation
of v6. Full diagnosis: [`docs/dev/plans/city-cost-methodology-v6.md`](docs/dev/plans/city-cost-methodology-v6.md) §1.

**v6 is integrated behind an opt-in feature flag, and v6.1 is the active implementation target.** On
10 August 2026 the owner stopped the attempt to independently validate all 19 behavioural presets. v6.1
keeps every existing tier, banks the genuine accommodation result, and replaces the unreachable evidence
programme with a three-call, source-native, honestly graded path. No new holdout is planned. The owner has
approved staged M4 migration of the existing 121-city library. The first 20-city provider attempt made zero
provider calls and is now classified as a credential preflight, not a source-coverage result. Audit then
found that city-cost provider calls do not enable web search and Expedia receives a zero-night window. The
live CSV remains on v1 while Phase 7 repairs those defects, runs a delegated operational canary, and proceeds
through the complete staged preview and owner-reviewed cutover.

**13 August 2026 current v6.1 state:** Experiment 014 passed the delegated operational canary, Phase 8 migration
tooling is complete, and Phase 9 has staged 70/121 cities in batches 001–005. Batch 005 remained below the artifact
stop rule (Aomori was the only all-prior candidate, 10%); 51 cities remain. The exact next action is fixed delegated
batch 006, followed by the complete verification baseline. The live CSV, holdouts and Phase 11 remain untouched.

---

## The v6.1 methodology in one paragraph

Make exactly three bounded search-snippet calls per city: Expedia for a 3-star room, BudgetYourTrip for its
three daily food and three daily activity tiers, and Numbeo for cappuccino and domestic beer. Deterministic
code converts those source-native facts into all 19 existing product fields. Accommodation uses the banked
ladder; food and activities use BYT's per-person daily tiers at ×2; drinks remain explicit consumption
presets; street food and cocktail are disclosed models. Grade every value **A** through **D**, attach an
interval and use one regional/global tier-vector fallback per category.

The refined rule is: *measure what is systematic, model the remaining product presets, and never disguise
a model or fallback as observed evidence.* An explicit grade-D product assumption is preferable to an
unreachable research programme.

---

## Why v6 exists

v5's gates were unreachable, and the accuracy they were protecting had already been achieved. Pooling
v5's own Expedia evidence and scoring leave-one-out at city level:

| Relation | Matched cities | Coefficient | LOO median APE | p90 | v4 independent fit | Agreement |
| --- | --- | --- | --- | --- | --- | --- |
| `accom_2_star ← accom_3_star` | 18 | 0.7500 | **11.37%** | 24.63% | 0.7341 (Booking.com, n=16) | 2.17% |
| `accom_4_star ← accom_3_star` | 26 | 1.3372 | **12.98%** | 27.18% | 1.2972 (Booking.com, n=16) | 3.08% |

Two independent sources, different estimators, different years, different city samples — agreeing to
within 2–3%, at roughly half the error the v5 gate allowed. v5 rejected this fit **eleven times** for
having fewer than 30 matched cities. The sample-size gate was a proxy for "does this generalise?";
cross-source replication answers that better than a larger single-source sample would.

Reproduce with `node scripts/fit-city-cost-ladder-v6.mjs`.

---

## Milestones

Order is **not negotiable**. M1 ships before any accuracy work — that is the central correction to v5.

### M0 — adopt v6 — **complete** (9 August 2026)

- [x] `docs/dev/plans/city-cost-methodology-v6.md` — methodology and diagnosis
- [x] `data/reference/v6/data-dictionary-v6.md` — estimands + A/B/C/D grades
- [x] `data/reference/v6/validation-manifest-v6.json` — gates + 40-city panel, 15 locked holdout
- [x] `data/reference/v6/coefficients-v6.json` — generated ladder
- [x] `scripts/fit-city-cost-ladder-v6.mjs` — reproducible fit, supports `--check`
- [x] `LOOP-PROMPT-V6.md` — terminating loop; v5's archived with a banner
- [x] `docs/dev/handoffs/city-cost-v6.md` — restartable handoff
- [x] v5 plan doc bannered superseded; v5 closure appended to `LOG.md`
- [x] `AGENTS.md`/`CLAUDE.md` mirror repaired — `npm run docs:check-memory` was failing

### M1 — integrate — **complete (9 August 2026)**

Wire v6 into the app behind `CITY_COST_METHODOLOGY_V6=true`. Unset keeps the v1 generation path active.
**The 121-city CSV is untouched.**

- [x] Add the grade + interval types and propagate them through materialization
- [x] Implement the ladder from `coefficients-v6.json` on top of `deriveCityCostV5()`
- [x] Implement the grade-D regional/band prior so no field is ever blank
- [x] Build the three spine extractor prompts (Numbeo / Expedia / BudgetYourTrip) under `docs/prompts/`
- [x] Wire the multi-call collection path with retry-on-block and per-call telemetry
- [x] Feature flag: v6 generation is opt-in; existing CSV rows remain unchanged
- [x] Surface grade and interval in the `/dataset` UI and editor
- [x] Tests: ladder, grade propagation, basket worst-grade rule, fail-to-grade-D, collection retry, flagged generation

**Exit:** the flagged new-city path generates all 19 graded/intervalled values in the integration test; the
121-city CSV remains untouched; the verification baseline passes. A live provider smoke test still requires
a configured provider key.

### M2 — ground truth — **complete (9 August 2026)**

Collect the 40-city × 6-anchor panel defined in `data/reference/v6/validation-manifest-v6.json`.

- [x] Create a manifest-driven ledger for 25 development cities × 6 measures
- [x] Seal the holdout boundary before collection, then collect into the sealed holdout ledger
- [x] 25 development cities — 150 dated source cells resolved (147 found, 3 explicit `class_absent`)
- [x] Collect the paid-attraction anchor from an official/current city or attraction tariff page for all 25 development cities
- [x] 15 locked holdout cities — six measures per city collected and sealed; scored once after candidate freeze; **do not tune or rescore**
- [x] Browser automation or manual collection is explicitly allowed here

**Exit:** panel complete with source URLs, retrieval dates, currencies and tax status recorded. The frozen
reference window is 2026-09-17 to 2026-09-18; all 150 development cells are now resolved without carrying an
undated or inferred price: 25 attraction rows, 122 accommodation rows and three explicit one-star
`class_absent` results for Beijing, Nairobi and Melbourne. All six final development cities were collected
under `booking_top_picks_firstpage_median_v2`; the previous Delhi/Prague near-parity observations are retained
as dispersion, not a stop condition. The current decision procedure treats a row as an artifact candidate
only when a class-order violation exceeds 25%, a ratio correlates with inventory depth across the batch, or
the 3-star level is below A$10 or above A$400. Collection stops only when candidates exceed 30% of the batch.
The accommodation basis includes public promotional rates available to any logged-out visitor, excludes
membership-gated rates, and never records a strikethrough/original price as the amount. The Booking.com →
Expedia offset was fitted in M3 from 15 matched development cities. The 15-city holdout is stored in
`data/reference/v6/ground-truth/holdout-ledger.json`; it was read and scored once only after the candidate
was frozen in the seal.

### M2 ladder validation result

The full 25-city v2 development panel validates the four accommodation relationships against product ground
truth. `CONFIRMED` means the ground-truth median is inside the shipped coefficient interval.

| Relationship | Fitted k | 25-city GT median | Difference | M2 result |
| --- | ---: | ---: | ---: | --- |
| 4-star / 3-star | 1.337 | 1.395 | +4.3% | **CONFIRMED** (interval ±25%) |
| 1-star / 3-star | 0.666 | 0.727 | +9.2% | **CONFIRMED** (interval ±45%) |
| private room / 3-star | 0.592 | 0.795 | +34.4% | **REFUTED — refit in M3** |
| dorm / 3-star | 0.163 | 0.295 | +81.7% | **REFUTED — refit in M3; stale 2023 coefficient confirmed** |

The 1-star median uses n=22 because Beijing, Nairobi and Melbourne have explicit class absence; the other
relationships use n=25. v5 never validated a single relationship against product ground truth. v6 validated
all four across the development panel before the two refuted rungs were refit in M3.

### Historical M3 accommodation-only work (retained; insufficient for current M3)

- [x] Fit private-room and dorm development diagnostics from the 25-city Booking.com v2 ratios; retain the
  dorm refit and apply the documented post-score private rollback
- [x] Leave confirmed 4-star and 1-star coefficients unchanged
- [x] Fit the Booking → Expedia 3-star source offset on 15 matched development cities (above the ≥12 minimum)
- [x] Freeze one candidate configuration in `ground-truth/holdout-seal.json` before reading holdout values
- [x] Score gates 2–6 once after the freeze; do not tune or rescore

The frozen candidate that was scored used private `0.7955` with a `±52%` LOO-p90 residual interval and dorm
`0.2955` with a `±54%` interval. After the one-time score, the private coefficient was rolled back through
the generator to the pre-holdout v4-blended `0.5919 ±35%`; this is a rollback, not a holdout fit. The
development `0.7955` fit remains diagnostic evidence in `coefficients-v6.json`, and the current private rung
is no longer an independent holdout test. The source calibration record is in
`data/reference/v6/coefficients-v6.json`: Booking.com v2 development ground truth is the calibration target,
Expedia 3-star class-trend output is the production anchor, the runtime Expedia→Booking multiplier is `0.9361`,
and its LOO-p90 residual interval is `±41%`. Four matched Expedia rows are the documented bare-dollar proxy;
the offset absorbs that shared displayed-dollar basis and retains the provenance.

The one-time holdout score is in `data/reference/v6/ground-truth/holdout-scores.json` and is tied to the frozen
candidate hash. Because the holdout has no paired Expedia 3-star observation, Gate 2 is only partly evaluable:
conditional ladder median APE is dorm **32.98%**, private **31.89%**, 1-star **30.45%**, and 4-star **13.26%**;
the three-star row is not evaluable. Gate 3's accommodation number (Spearman 0.9642; pairwise 0.9429) is an
upper bound only because the observed three-star anchor is the dominant term and is also the prediction.
Gate 4 and the three-star component of Gate 6 are not evaluable; Gate 5 is not evaluable without food and
drink inputs. Gate 6 has four evaluable accommodation tiers and cannot claim the manifest's 15/19 requirement.
Gate 8 has a development fit but is not holdout-evaluable because the holdout contains no paired Expedia
anchor rows. Holdout attraction coverage is **6 found / 9 missing**, so activities are not validated.

The last disclosure gap was the production anchor, not the ladder. Experiment
`data/reference/v6/experiments/001-expedia-production-anchor/` collected one Expedia extractor response for
each of the 15 matched development cities using the same frozen window. All 15 were observed in 15 provider
calls and 52 searches, with zero blocks and zero direct page reads. Applying the frozen FX snapshot and
`0.9361` Expedia→Booking multiplier gave median APE **8.36%** and median signed error **+7.08%**; the
preregistered acceptance rule passed. No holdout was read and no refit was performed.

A complete product validation additionally needs paired food and drink ground truth for the same cities, plus
activity ground truth under the product's actual activity estimands. For a 15-city production-shaped panel,
that is three spine calls per city (Expedia, Numbeo and BudgetYourTrip): about **45 primary extractor calls**,
with a worst-case **375 searches** under the collector's 25-search-per-city ceiling, plus the manual/official
review needed to make the activity rows match the product estimand. This is enough to test the level anchor,
food/drink composition and activity semantics; the spent holdout cannot do so and must not be reopened.

**Superseded recommendation (recorded before the v6.1 simplification and 12 August M4 decision):** complete the cheap 15-city paired-anchor experiment now, but do not collect the full basket
or migrate the 121-city CSV before a separate, explicitly scoped validation tranche is approved. If the anchor
experiment is accepted, keep v6 flag-on for **new cities only** while the 121-city CSV remains on v1. The full
food/drink/activity panel is worth collecting before CSV migration because Gates 4 and 5 otherwise remain
untestable, but it is not worth delaying the low-risk new-city pilot or pretending the current holdout proves
absolute levels.

M1 implementation notes:

- `src/lib/city-cost-methodology-v6.ts` is the deterministic ladder, basket-grade, interval and prior boundary.
- `src/lib/city-cost-v6-collection.ts` runs three specialist search-snippet calls, retries a reported block once,
  preserves missingness, converts through the frozen FX snapshot, and records per-call telemetry.
- `src/lib/city-generation.ts` switches to v6 only when `CITY_COST_METHODOLOGY_V6=true`; v1 remains the default.
- v6 provenance is persisted in `city_estimates.metadata_json` and shown on `/dataset`. The live CSV and seed path
  are unchanged.

### Historical M3 — all-tier independent validation — **stopped; evidence retained**

The 25-city development ledger, experiment 006 prediction bundles, experiment 003 BYT panel, corrected
in-sample score and food-basket diagnostic remain valid evidence. They established that accommodation is
genuinely measurable but that food, drink and activity planner presets do not have 19 independent public
price counterparts. The 450-slot development ledger resolved 280 found rows; the spent fresh extension
found only 12/180 rows. Requiring another holdout would repeat the same structural failure. No holdout may
be reopened or replaced under v6.1.

### M3.1 — simplify and finish v6.1 — **MATERIALIZER AND RELEASE CONTRACT BANKED**

The implementation contract is
[`docs/dev/plans/city-cost-methodology-v6-1.md`](docs/dev/plans/city-cost-methodology-v6-1.md). It keeps
all 19 tiers while reducing the runtime spine to three calls and at most ten searches per city.

- [x] Freeze the owner-approved source map and all 19 derivations
- [x] Draft the three versioned v6.1 extraction prompts
- [x] Freeze reachable release gates in `validation-manifest-v6-1.json`
- [x] Replace the autonomous loop and cold-start handoff
- [x] Add v6.1 response schemas while preserving v6.0 stored-response parsing
- [x] Implement the simplified materializer and one category fallback layer
- [x] Generate v6.1 priors and 25-city fixtures from experiments 003 and 006; make no new LLM calls
- [x] Produce the deterministic 19-tier release report and reachable gate result
- [x] Wire the new-city path behind `CITY_COST_METHODOLOGY_V6=true` and verify v1 rollback
- [x] Verify the v6.1 release validator, generated priors/materialization and full provenance replay
- [x] Reconcile the generated cocktail coefficient with the manifest and add a drift regression

Phase 3 replay result: the v6.1 Stage-A fixture set contains 25 cities and 75 normalized source
responses, with zero new collection calls. Stage B produces all 19 tiers for 25/25 cities through
`materializeCityCostV61`. Category fallback was used for accommodation in 5 cities, food in 1, drinks
in 12 and activities in 1. The new-city feature flag now uses v6.1; the historical v6.0
collector/materializer remains available for stored replay and the v1 path remains the rollback.

The earlier Phase 4 release-check claim that nine reachable gates had all passed is superseded by the
12 August 2026 release-hardening correction. `scripts/validate-city-cost-v6-1-release.mjs --check` now
computes the measured gates on the 25 x 19 replay, records development coverage as 25/25, records runtime
>=95% coverage as **unmeasured**, and records verification as **external** rather than silently omitting
Gate 10. The generated report is
[`data/reference/v6/v6-1-development-release-report.md`](data/reference/v6/v6-1-development-release-report.md);
its v1 comparison is informational only. The read-only rollout preview is in
[`data/reference/v6/v6-1-rollout-preview.md`](data/reference/v6/v6-1-rollout-preview.md), with complete
city × tier and basket detail in the adjacent JSON and the unchanged CSV hash. No holdout was read and the
121-city CSV is byte-unchanged.

The generated cocktail coefficient is `2.4838`, n=14, grade C, ±64%. Phase 6 reconciled the active manifest,
reports and narrative contract to that generated value and added a validator assertion covering the key,
source anchor, value, grade, interval, authority and relation text. A temporary regression with the old
`2.6`, ±75% declaration failed `--check` as required. No refit was performed.

### M4 — migrate the existing 121-city library — **OWNER APPROVED; PHASE 7H COMPLETE, FRESH CANARY NEXT**

The 12 August 2026 owner decision supersedes the earlier new-city-only recommendation. The desired final
state is one coherent v6.1 library for existing and new cities. The current CSV remains read-only until a
complete staged migration is reviewed.

- [x] Reconcile manifest/docs/generated reports with generated coefficients; add a drift assertion
- [x] Pre-register and attempt a representative 20-city provider canary; it made zero provider calls because
  no server-side provider credential was configured and is retained as a preflight record, not 0% coverage
- [x] Repair the initial production collection boundary: enable provider web search, pass distinct Expedia arrival
  and departure dates, preserve partial calls, and make the canary evaluator enforce every registered gate
- [x] Complete the corrected Phase 7D boundary repair: canonical country identity, safe non-observed missingness,
  independent source-call preservation, canonical Numbeo beer labels, artifact-signature reporting and hashed
  canary evidence in the release validator
- [x] Run the one owner-authorized corrected delegated 20-city canary through exact production prompts and shipped
  Stage B; it failed at 10/20 complete cities and 50% artifact candidates because Stage A did not complete the
  registered 60-call frame. Preserve it as immutable operational delegation failure, not source-quality evidence.
- [x] Repair delegated collection lifecycle after experiment 012: independent slot inventory, partial-file
  preservation, terminal-frame finalization guard, immutable-history compatibility and complete reporting
- [x] Run experiment 013 with 32 validated 012 reuses plus collection of 28 pending slots; preserve its immutable
  failed 19/20 result and duplicate-Prague incident without promoting it to a pass
- [x] Prove field-by-field persistence/API provenance round-trip in deterministic tests and all 20 experiment-013
  materializations; do not count all-prior materialization as source coverage
- [x] Owner authorized the Phase 7H repair after re-auditing experiment 013: implement an exclusive write-once slot
  claim and repair the evaluator's unreachable `problems.length === 0` aggregate predicate; the fresh canary remains
  a separate gated action
- [x] Complete Phase 7H lifecycle/evaluator repair and focused regression tests, preserving experiments 010–013
- [x] Run experiment 014 as the one fresh immutable canary, reusing 58 valid 013 calls and recollecting only Prague
  BYT/Numbeo; it passed 20/20 with zero artifact candidates and full provenance equality
- [ ] Build a frozen, resumable and deterministic migration pipeline independent of the live CSV, using experiment 014
  as the dry run
- [ ] Validate any reuse of the 25 fixture-city responses against the frozen migration window
- [ ] Generate all 121 cities in batches into a staged CSV plus full provenance sidecar
- [ ] Import/link the sidecar through `city_estimates` so seeded existing-city provenance is runtime-visible
- [ ] Produce the complete operational impact report, including all >2×/<0.5× flags and regional fallback
- [ ] Stop for owner review before replacing the live CSV or changing the generation default
- [ ] Before cutover, run a 3–5-city user-key smoke of provider authentication/search plus the real DB/API
  boundary; this does not block migration tooling or staging
- [ ] After approval, atomically cut over the generated CSV and v6.1 new-city default
- [ ] Test the coordinated rollback of both the old CSV and v1 generation path

Collection bounds are 363 primary calls and 1,210 searches for a complete recollection, or 288 new calls
if all 25 existing fixture cities qualify for documented reuse. Report actual calls, retries, searches and
reuses. Codex subagents are the approved Stage-A route for the operational canary and bulk migration when
app-provider credentials are unavailable, with the shipped parser/materializer/persistence path always used
for Stage B. Production users still supply their own provider key. A later small key-backed smoke tests the
transport boundary; ≥95% complete-generation coverage is a post-release operational SLO, not a claim proved
by a 19/20 pre-release sample.

**Exit:** all 121 cities and newly generated cities use v6.1 with complete runtime-visible provenance, the live cutover was
owner-reviewed, and one tested rollback restores both the v1 CSV and v1 generation default. No holdout was
opened and no accommodation coefficient was refit.

### M5 — improve weak grades — ongoing

- [ ] `accom_1_star` — interpolated, zero direct evidence, weakest number in the ladder
- [ ] Hostel dorm/private split — the v4 channel could not distinguish them
- [ ] Activity validation — daily spend is structurally unvalidated; Price of Travel is the candidate independent panel to test later
- [ ] Private-room rung — development `0.7955` versus holdout-implied `0.603`; current `0.5919` rollback is
  no longer an independent test. Treat this as the primary cost-banded R1 candidate.
- [x] Dorm coefficient — stale 2023 index finding confirmed and replaced by the Booking v2 development fit;
  retain the source and first-page-bias caveats

---

## Open product decisions

Each has a stated default so no work is blocked waiting for an answer. Active v6.1 context is in
[`docs/dev/plans/city-cost-methodology-v6-1.md`](docs/dev/plans/city-cost-methodology-v6-1.md).

| # | Decision | Default if unanswered |
| --- | --- | --- |
| 1 | Six accommodation tiers, or merge `accom_1_star` into a budget band? | Keep six; ship 1★ at grade C |
| 2 | How prominently is the grade shown in the UI? | Per-city badge + per-value tooltip, reusing the dashboard info-popover pattern |
| 3 | Refresh cadence | Re-measure levels quarterly; refit coefficients annually |
| 4 | Regenerate all 121 cities, or only new ones? | **Settled 12 August 2026:** migrate all 121 through staged M4; review before cutover |

---

## Active v6.1 release gates

Frozen before implementation in
[`data/reference/v6/validation-manifest-v6-1.json`](data/reference/v6/validation-manifest-v6-1.json):

1. **Development fixture coverage** — all 19 fields for 25/25 fixtures; measured by replay
2. **Runtime coverage** — ≥95% in scope; **unmeasured**, not a pass from development fixtures
3. **Schema and missingness** — source-specific validation; collection never invents a missing fact
4. **Provenance and grades** — every tier names its basis, grade, interval, sources and imputations
5. **Algebraic coherence** — finite, non-negative and ordered presets for all fixtures
6. **Accommodation accuracy** — preserve the genuine six-tier result, each below 35% median APE
7. **Source-dependence disclosure** — report direct-source and grade-D fallback rates by category/region
8. **Deterministic replay** — fixture materialization is byte-identical under `--check`
9. **Refresh economics** — exactly three calls, at most ten searches and zero direct page reads per city
10. **Integration and rollback** — pure persistence/provenance round-trip, flag-off uses v1, live CSV byte-identical
11. **Verification** — external baseline evidence is recorded; this validator does not claim to observe it

The old all-19 accuracy, full independent ranking, trip-total and beat-v1 gates are historical non-gates
for v6.1. They required independent observations for behavioural presets that public sources do not publish.
The v6.0 manifest and spent scores remain immutable evidence; their claims are not rewritten.

---

## Stopping rules

These are why v6.1 terminates. Full text is in `LOOP-PROMPT-V6.md` §8.

- **Three strikes** — three consecutive failures of the same gate for the same structural reason ⇒ report
  the gate as the defect; do not attempt a fourth.
- **Bank what works.** Do not refuse to bank a solved category because another is unsolved.
- **Grade D is a completed field**, not a blocked one.
- **No evidence rescue.** Missing independent food/drink/activity truth is a disclosed source dependency,
  not permission for more collection.
- **Ask only on scope change.** Stop for a fourth call, new source, holdout, CSV migration, tier removal or
  accommodation refit; use the approved fallback for ordinary missingness.

---

## Key v6 files

| Path | What it is |
| --- | --- |
| `docs/dev/plans/city-cost-methodology-v6-1.md` | **Active implementation plan and Definition of Done** |
| `docs/dev/plans/city-cost-methodology-v6.md` | Historical v6.0 methodology and v5 diagnosis |
| `docs/dev/handoffs/city-cost-v6.md` | **Restartable handoff — read this first on a cold start** |
| `LOOP-PROMPT-V6.md` | The autonomous work prompt, with stopping rules |
| `data/reference/v6/README.md` | Evidence inventory and orientation |
| `data/reference/v6/data-dictionary-v6.md` | Frozen estimands + evidence grades |
| `data/reference/v6/validation-manifest-v6-1.json` | Active reachable v6.1 release gates |
| `data/reference/v6/validation-manifest-v6.json` | Historical v6.0 gates + spent holdouts |
| `data/reference/v6/coefficients-v6.json` | Generated ladder — never hand-edit |
| `scripts/fit-city-cost-ladder-v6.mjs` | Reproducible fit; `--check` for verification |
| `src/lib/city-cost-methodology-v5.ts` | The derivation function — **reused by v6 unchanged** |
| `data/reference/v5/experiments/` | 95 v5 experiments, retained in full as evidence |

---

## Verification baseline

```
npx tsc --noEmit                              # expected to pass
npm run build                                 # expected to pass
npm test -- --run                             # expected to pass
npm run docs:check-memory                     # AGENTS.md mirrors CLAUDE.md
node scripts/fit-city-cost-ladder-v6.mjs --check   # coefficients match the evidence
node scripts/test-city-cost-v6-ground-truth-warnings.mjs
node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete
```

`/api/export` is dynamic because it reads request headers — this build note is expected.

---

## Unrelated app backlog

- [ ] Add tests around city generation parsing and Wise import format handling.
- [ ] Expand Playwright from planner regressions into full add-leg / generation success-path tests.
- [ ] Add provider/model capability validation for planner transport estimation.
- [ ] Add automated coverage around bulk transport estimation and planner apply flows.
- [ ] Consider transport-estimation caching — explicitly deprioritised.

### v6.1 release-hardening correction — 12 August 2026

The earlier statement that the nine reachable release gates had all passed and that v6.1 was fully
complete is superseded. The implementation is banked, but the production persistence boundary was still
v6.0-only until commit `a8e93ce`, and the release validator previously hardcoded source-dependence and
integration gates while omitting manifest Gate 10.

The corrected validator now computes the measured development gates from the 25 x 19 replay, records
development fixture coverage as 25/25, records runtime >=95% coverage as **unmeasured**, and records the
verification baseline as **external** rather than calling it passed. The v1 rollback remains intact and
the 121-city CSV and all holdouts remain untouched. Phase 4 frozen-FX maintenance and Phase 5 rollout
preview were still open at that point; both were subsequently completed below.

### v6.1 Phase 4 FX completion — 12 August 2026

The frozen 22 July FX metadata maintenance is complete. SGD, TWD, ZAR and PEN now have source-attributed
rates; generated priors exclude 0 rows rather than 34, and direct Numbeo drink coverage rises from 13/25
(52%) to 17/25 (68%). The 25-city materializations, release validation and report were regenerated with
no city-price collection, holdout access, accommodation refit or shipping-CSV change. The generated
coefficient artifact was refreshed to restore its deterministic check after the earlier street-food
gating change; the accommodation coefficients and source offset are unchanged. Phase 5—the rollout
preview and owner review—is now the exact next action.

---

### v6.1 Phase 5 rollout preview — 12 August 2026

The deterministic, read-only comparison is generated at
[`data/reference/v6/v6-1-rollout-preview.md`](data/reference/v6/v6-1-rollout-preview.md), with complete
city × tier and basket detail in the adjacent JSON and the protocol in experiment 009. It compares all
25 existing v6.1 fixtures against the unchanged 121-city v1 CSV, records the CSV SHA-256, category
subtotals, representative budget/mid/high baskets, distribution tails and explicit >2x/<0.5x flags.
It is an operational impact preview, not ground-truth validation. It recommends v6.1 for NEW cities only
behind the existing flag after owner review; it does not recommend global activation or CSV migration.
Phase 5 is complete and the workstream now stops for owner review.

### v6.1 M4 migration decision — 12 August 2026

The owner accepted the implementation review and approved migration of the existing 121-city library as
part of v6.1. This supersedes, without deleting, the Phase 5 new-city-only recommendation. The sequence is
release-contract reconciliation, a measured 20-city provider-path canary, resumable staged regeneration,
a complete 121-city operational-impact report, and owner review before atomic cutover.

The 25-city preview's 82/450 tier-level >2×/<0.5× differences make indefinite mixed-method operation a
poor endpoint, but they are not ground truth and must not be used to tune v6.1 toward v1. The migration
therefore replaces the library coherently or rolls back coherently: CSV and new-city default move together.
The live CSV remains unchanged until the staged artifact is complete and explicitly approved.

### v6.1 Phase 7D canary-boundary correction — 12 August 2026

Experiment 011 is immutable failed evidence at 17/20 complete, not pending and not passed. Its Dubai identity,
Cape Town/Lima missingness serialization and partial-call preservation failures are now regression targets. The
Numbeo drinks contract accepts either exact canonical domestic draft-beer label (`0.5 Liter` or `1 Pint`) without
conversion; the previous 1-pint-only contract is superseded. The release validator reads a hashed canary artifact
and reports the recorded 011 failure. The next exact action is to run the single authorized fresh experiment 012
through Codex-delegated Stage A and shipped Stage B; stop if it misses 19/20 or exceeds 30% artifact candidates.

### v6.1 Phase 7F lifecycle correction — 12 August 2026

Experiment 012 is immutable incomplete-orchestration evidence, not a clean canary: its original run reported 10/20,
but its directory contains 35 raw files, 32 telemetry files and only 32 reusable pairs in a 60-slot frame. The new
inventory reports 28 pending slots and preserves the Lisbon/Prague pairs and Colombo/Dubai raw-only evidence instead
of dropping sibling calls. Finalization now refuses any new experiment with pending slots. At the Phase 7F boundary,
experiment 013 had not yet been created; Phase 7G below records what followed.

### v6.1 Phase 7G resumable canary — 12 August 2026

Experiment 013 is complete and immutable. It reused 32 valid experiment-012 calls, collected the remaining 28
registered slots, and reached 60/60 terminal records. Nineteen cities passed the complete source contract; all 20
materialized 19 tiers and passed persistence/API provenance equality. The corrected Numbeo contract observed both
cappuccino and domestic beer in 19/20 cities. Category direct/fallback counts were accommodation 10/10, food 18/2,
drinks 17/3 and activities 18/2; no city was all-prior.

The recorded result is nevertheless failed. A parallel spawn command started an unreturned Prague worker before
reporting its thread-limit error, and a later assignment repeated Prague BYT and Numbeo. Those two slots were
invalidated rather than hidden. The experiment records 62 actual provider calls, 11 assignment attempts, two retries,
zero direct reads and 167 standard searches; its incident record adds four overwritten-attempt searches, so 171 were
actually made. No further collection is authorized.

The run exposed a second contract defect: `evaluateV61CanaryBatch` requires `problems.length === 0`, so any diagnostic
from the one city explicitly tolerated by the 19/20 gate still forces overall failure. The numeric 19/20 and 30%
thresholds were met, but experiment 013 is not restated as a pass. Phase 8 is blocked pending an owner decision.

### v6.1 Phase 7H repair decision — 12 August 2026

The post-run audit found two independent lifecycle defects. First, assignment recording enforced unique assignment IDs
but did not atomically reserve city/source slots before delegated work began; a thread-limit report arrived after a
Prague worker had started, and a later assignment duplicated those two slots. Second, the evaluator conflated
per-city diagnostics with batch-fatal violations, so its `problems.length === 0` predicate contradicted the registered
19/20 tolerance. The owner authorized implementing both repairs before another canary. Experiments 010–013 remain
immutable, the 58 valid experiment-013 calls remain reusable, and no new canary, migration, holdout access or live CSV
write occurs during this repair phase. The repair completed with write-once slot-claim and 19/20 predicate tests,
the full verification baseline, and no new canary or migration collection.

### v6.1 Phase 8 completion and Phase 9 start — 13 August 2026

Experiment 014 subsequently passed the one authorized fresh canary at 20/20 complete cities, so the migration
gate is open. Phase 8 is now complete: the frozen 121-city protocol under
`data/reference/v6/migration-v6-1/` records the unchanged input CSV/FX/prompt/implementation hashes and forbids
live-CSV writes; the 60 validated experiment-014 calls were reused for a 20-city dry run; the shipped materializer
produced 20 complete v6.1 bundles; and the staged CSV, provenance sidecar, import plan, checkpoint and call-level
reuse records pass deterministic checks. The non-live importer rejects partial sidecars and the live database.

Phase 9 is active for the remaining 101 cities. The exact next action is to assign and collect the first fixed
batch through the frozen three-call route, materialize it, run the complete baseline and commit/push the batch.
The live CSV, all holdouts and Phase 11 remain untouched. This supersedes the earlier statement that Phase 8 was
blocked after experiment 013; experiments 010–013 remain immutable historical evidence.

### v6.1 Phase 9 batch 001 — 13 August 2026

The first fixed 10-city migration batch is complete and staged: Can Tho, Mui Ne, Cat Ba, Ninh Binh, Pu Luong,
Hoi An, Da Lat, Nha Trang, Phu Quoc and Sa Pa. It added 30 delegated source calls and 100 searches, with zero
retries and zero direct page reads. Direct category counts were accommodation 3/10, food 7/10, drinks 4/10 and
activities 7/10; one city (Pu Luong) was all-prior and therefore an artifact candidate, 10% of the batch. The
candidate rate is below the 30% stop rule, so work continues. The staged migration now has 30/121 complete cities;
91 remain. The next exact action is to assign and collect fixed batch 002, then materialize and verify it before
committing.

### v6.1 Phase 9 batch 002 - 13 August 2026

The second fixed 10-city migration batch is complete and staged: Luang Prabang, Vientiane, Don Det, Vang Vieng,
Siem Reap, Phnom Penh, Kampot, Yangon, Bagan and Cebu. It added 30 delegated source calls and 100 searches, with
zero retries and zero direct page reads. Direct/fallback category counts were accommodation 6/4, food 7/3, drinks
4/6 and activities 6/4. Don Det was all-prior and is recorded as one artifact candidate (10%), below the 30% batch
stop rule. The staged migration now has 40/121 complete cities; 81 remain. The next exact action is to assign and
collect fixed batch 003, then inventory, materialize, verify and commit it. The live CSV and holdouts remain untouched.

### v6.1 Phase 9 batch 003 - 13 August 2026

The third fixed 10-city migration batch is complete and staged: Santa Fe (Bantayan), Manila, Palawan (El Nido),
Siargao, Bangkok, Chiang Mai, Phuket, Koh Samui, Pai and Krabi. It added 30 delegated source calls and 100 searches,
with one retry and zero direct page reads. Direct/fallback category counts were accommodation 6/4, food 6/4, drinks
4/6 and activities 6/4. Santa Fe (Bantayan) and Siargao were all-prior artifact candidates, 20% of the batch, below
the 30% stop rule. The staged migration now has 50/121 complete cities; 71 remain. The next exact action is to
assign and collect fixed batch 004, then inventory, materialize, verify and commit it. The live CSV and holdouts
remain untouched.

### v6.1 Phase 9 batch 004 - 13 August 2026

The fourth fixed migration batch is complete and staged: Chiang Rai, Bali (Kuta), Bali (Ubud), Bali (Canggu),
Jakarta, Yogyakarta, Lombok, Kuala Lumpur, Penang and Langkawi. It added 30 delegated source calls and 100 searches,
with zero retries and zero direct page reads. Direct/fallback category counts were accommodation 5/5, food 6/4,
drinks 0/10 and activities 6/4. No city was an artifact candidate, so the batch remains below the 30% stop rule.
The 0/10 direct drink category is recorded as an operational coverage finding for Phase 10, not a coefficient or
collection artifact decision. The staged migration now has 60/121 complete cities; 61 remain. The next exact action
is fixed batch 005; the live CSV, holdouts and Phase 11 remain untouched.

### v6.1 Phase 9 batch 005 - 13 August 2026

The fifth fixed migration batch is complete and staged: Busan, Osaka, Kyoto, Kanazawa, Aomori, Nikko, Sendai,
Hiroshima, Fukuoka and Nara. It added 30 delegated source calls and 100 searches, with zero retries and zero direct
page reads. Direct/fallback category counts were accommodation 3/7, food 6/4, drinks 4/6 and activities 6/4. Aomori
was the only all-prior artifact candidate (10%), below the 30% batch stop rule. Expedia was directly observed in 3/10
cities, BudgetYourTrip in 6/10 and Numbeo drinks in 4/10; all remaining source gaps stayed explicit and used the
shipped prior cascade. The staged migration now has 70/121 complete cities; 51 remain. The next exact action is fixed
batch 006; the live CSV, holdouts and Phase 11 remain untouched.

## Traps retained from earlier work

Hard-won across v3, v4 and v5. All still true.

1. A model's explanation for a failure is a hypothesis; verify the response independently.
2. Contract defects often look like model unreliability.
3. Never ask the model to grade its own work.
4. A contract that fights the shape of its sources will lose.
5. Inspect the underlying record, not only a summary.
6. On rate limiting, defer the city; do not silently fall through to search.
7. Do not adopt a promising result on one city's evidence.
8. **New from v5:** an unreachable gate is a defect in the gate, not a reason to collect more. Measure
   whether a gate has ever been passed by anything before spending another experiment on it.
