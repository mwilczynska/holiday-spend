# Holiday Spend — Plan

The working document for the current workstream. Confirmed historical results and rejected methodologies
live in [LOG.md](LOG.md). Project memory is in [CLAUDE.md](CLAUDE.md).

**Active workstream:** city cost methodology **v6**
**Last reviewed:** 10 August 2026
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

**v6 is adopted and M1 is integrated behind an opt-in feature flag.** The original accommodation-scoped M2
and M3 records are retained, but the owner has reopened M3: it now means fitting and holdout-validating all
19 product tiers. M4 must not start until that work is complete or an explicit unvalidation reason is recorded.

---

## The v6 methodology in one paragraph

Measure **one level per category** with cheap search-snippet extraction — food and drink from Numbeo, one
accommodation level (`hotel_3star_room_2p`) from Expedia, activity tiers from BudgetYourTrip. Derive
everything else in deterministic code from fitted ratios. Grade every value **A** (observed) through **D**
(regional prior), attach an interval, and ship it. A modelled value is never presented as observed.

This is v4's governing principle — *measure what is cheap to measure, model only the gaps, never assert a
constant* — finally executed rather than blocked.

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

Recommendation: complete the cheap 15-city paired-anchor experiment now, but do not collect the full basket
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

### M3 — fit and validate all 19 tiers — **IN PROGRESS (scope reset 10 August 2026)**

- [x] Record the dated contract amendment from six accommodation-scoped measures to 17 all-tier validation rows
- [ ] Collect the 11 new independent development measures across all 25 cities
- [ ] Generate and cross-check every non-accommodation derivation from the development panel
- [ ] Collect the 11 fresh holdout measures under per-measure seals without reading them
- [ ] Freeze one all-19 candidate and score gates 2–6 once
- [ ] Publish the all-19 derivation, development fit, holdout result and v1 comparison table

**Current status:** Phase 1 contract reset is complete. Experiment 002 batch 001 resolved all ten
non-accommodation slots for Hanoi, Ho Chi Minh City, Da Nang, Phuket, Singapore and Taipei using current
official menus and explicit missingness where the independent route did not yield a compliant observation.
Coverage is now **203 found / 190 pending** across the 25-city x 17-measure development panel. The remaining
190 cells are the ten non-accommodation measures for the other 19 development cities. The per-measure
holdout seal keeps the six already revealed rows spent and has created eleven sealed-before-collection
extension measures. The old accommodation-only score is not an all-19 M3 result. M4 migration remains out
of scope.

### M4 — migrate — **not started; do not begin before anchor disclosure is closed**

- [ ] Regenerate all 121 cities through v6 with grades
- [ ] A/B diff report against the current CSV, per tier and per city
- [ ] Rollback tested
- [ ] Switch the flag

**Exit:** v6 is the shipping path with a tested rollback.

### M5 — improve weak grades — ongoing

- [ ] `accom_1_star` — interpolated, zero direct evidence, weakest number in the ladder
- [ ] Hostel dorm/private split — the v4 channel could not distinguish them
- [ ] Activity semantics — BudgetYourTrip measures reported spend, not ticket prices
- [ ] Private-room rung — development `0.7955` versus holdout-implied `0.603`; current `0.5919` rollback is
  no longer an independent test. Treat this as the primary cost-banded R1 candidate.
- [x] Dorm coefficient — stale 2023 index finding confirmed and replaced by the Booking v2 development fit;
  retain the source and first-page-bias caveats

---

## Open product decisions

Each has a stated default so no work is blocked waiting for an answer. Full context in
[`docs/dev/plans/city-cost-methodology-v6.md`](docs/dev/plans/city-cost-methodology-v6.md) §8.

| # | Decision | Default if unanswered |
| --- | --- | --- |
| 1 | Six accommodation tiers, or merge `accom_1_star` into a budget band? | Keep six; ship 1★ at grade C |
| 2 | How prominently is the grade shown in the UI? | Per-city badge + per-value tooltip, reusing the dashboard info-popover pattern |
| 3 | Refresh cadence | Re-measure levels quarterly; refit coefficients annually |
| 4 | Regenerate all 121 cities, or only new ones? | Keep the 121-city CSV on v1 and run v6 for new cities until paired-anchor and full-basket validation supports migration |

---

## Acceptance gates

Frozen in [`data/reference/v6/validation-manifest-v6.json`](data/reference/v6/validation-manifest-v6.json).
Summary:

1. **Coverage** — 19/19 numeric for ≥95% of cities, every value graded
2. **Tier accuracy** — median APE ≤35%, p90 ≤75%, absolute median signed error ≤15%
3. **City ranking** — Spearman ρ ≥0.90, pairwise ordering ≥85% ← *the gate that matters*
4. **Cost-band agreement** — ≥80% exact, 100% within one band
5. **Trip-level realism** — 10-city trip total within ±20%
6. **No regression vs v1** — beat v1 on ≥15 of 19 tiers, lose on none by >10% ← *the gate v5 never had*
7. **Repeatability** — 3 calls × 5 hard cities, relative range ≤25% for grades A/B
8. **Calibration integrity** — every offset fitted on ≥12 cities and reduces held-out APE
9. **Refresh economics** — ≤6 calls, ≤25 searches, ≤A$0.15/city; full refresh ≤A$20, ≤24h
10. **Provenance** — no grade C/D value renderable without its grade

**Amendment rule.** A gate may be amended only *before* the holdout is used, with a dated rationale
here and in the manifest. Never weaken a gate after seeing its result. **A gate that no method can meet
is a defect in the gate** — see the three-strikes rule in `LOOP-PROMPT-V6.md` §5.

---

## Stopping rules

These are why v6 terminates and v5 did not. Full text in `LOOP-PROMPT-V6.md` §5.

- **Three strikes** — three consecutive failures of the same gate for the same structural reason ⇒ report
  the gate as the defect; do not attempt a fourth.
- **Per-field budget: 8 experiments.** Reaching it means accept the best available grade and move on.
  *(v5 ran 15 on `accom_1_star` and got zero rows.)*
- **Bank what works.** Do not refuse to bank a solved category because another is unsolved.
- **Grade D is a completed field**, not a blocked one.

---

## Key v6 files

| Path | What it is |
| --- | --- |
| `docs/dev/plans/city-cost-methodology-v6.md` | The methodology, the v5 diagnosis, milestones, risks |
| `docs/dev/handoffs/city-cost-v6.md` | **Restartable handoff — read this first on a cold start** |
| `LOOP-PROMPT-V6.md` | The autonomous work prompt, with stopping rules |
| `data/reference/v6/README.md` | Evidence inventory and orientation |
| `data/reference/v6/data-dictionary-v6.md` | Frozen estimands + evidence grades |
| `data/reference/v6/validation-manifest-v6.json` | Frozen gates + 40-city panel with locked holdout |
| `data/reference/v6/coefficients-v6.json` | Generated ladder — never hand-edit |
| `scripts/fit-city-cost-ladder-v6.mjs` | Reproducible fit; `--check` for verification |
| `src/lib/city-cost-methodology-v5.ts` | The derivation function — **reused by v6 unchanged** |
| `data/reference/v5/experiments/` | 95 v5 experiments, retained in full as evidence |

---

## Verification baseline

```
npx tsc --noEmit                              # expected to pass
npm run build                                 # expected to pass
    npm test -- --run                             # 153 tests
npm run docs:check-memory                     # AGENTS.md mirrors CLAUDE.md
node scripts/fit-city-cost-ladder-v6.mjs --check   # coefficients match the evidence
```

`/api/export` is dynamic because it reads request headers — this build note is expected.

---

## Unrelated app backlog

- [ ] Add tests around city generation parsing and Wise import format handling.
- [ ] Expand Playwright from planner regressions into full add-leg / generation success-path tests.
- [ ] Add provider/model capability validation for planner transport estimation.
- [ ] Add automated coverage around bulk transport estimation and planner apply flows.
- [ ] Consider transport-estimation caching — explicitly deprioritised.

---

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
