# Holiday Spend — Plan

The working document for the current workstream. Confirmed historical results and rejected methodologies
live in [LOG.md](LOG.md). Project memory is in [CLAUDE.md](CLAUDE.md).

**Active workstream:** city cost methodology **v6**
**Last reviewed:** 9 August 2026
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

**v6 is adopted and M1 is integrated behind an opt-in feature flag.** The next work is **M2 — ground truth**.

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

### M2 — ground truth — **in progress (9 August 2026)**

Collect the 40-city × 6-anchor panel defined in `data/reference/v6/validation-manifest-v6.json`.

- [x] Create a manifest-driven ledger for 25 development cities × 6 measures
- [x] Seal the holdout boundary without storing holdout prices or scores
- [x] 25 development cities — 150 dated source cells resolved (147 found, 3 explicit `class_absent`)
- [x] Collect the paid-attraction anchor from an official/current city or attraction tariff page for all 25 development cities
- [ ] 15 locked holdout cities — **collect, then seal; do not score against them yet**
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
Expedia offset threshold is crossed, but the offset remains deliberately unfitted until M3.

### M2 ladder validation result

The requested 19-city v2 panel validates all four accommodation relationships against product ground truth.
The 1-star relationship has n=17 because Beijing and Nairobi have explicit class absence; the other three
relationships have n=19. `CONFIRMED` means the ground-truth median is inside the shipped coefficient interval.

| Relationship | Fitted k | 19-city GT median | Difference | M2 result |
| --- | ---: | ---: | ---: | --- |
| 4-star / 3-star | 1.337 | 1.404 | +5.0% | **CONFIRMED** (interval ±25%) |
| 1-star / 3-star | 0.666 | 0.745 | +11.9% | **CONFIRMED** (interval ±45%) |
| private room / 3-star | 0.592 | 0.800 | +35.2% | **At interval edge — M5 correction candidate** |
| dorm / 3-star | 0.163 | 0.319 | +96.5% | **REFUTED — stale 2023 coefficient confirmed** |

The six-city extension refreshes these medians to 1.395 (4-star, n=25), 0.727 (1-star, n=22), 0.795
(private, n=25) and 0.295 (dorm, n=25); the interpretation is unchanged. v5 never validated a single
relationship against product ground truth. v6 has now validated all four against the 19-city panel and
rechecked them after the full development tranche, without refitting coefficients.

M1 implementation notes:

- `src/lib/city-cost-methodology-v6.ts` is the deterministic ladder, basket-grade, interval and prior boundary.
- `src/lib/city-cost-v6-collection.ts` runs three specialist search-snippet calls, retries a reported block once,
  preserves missingness, converts through the frozen FX snapshot, and records per-call telemetry.
- `src/lib/city-generation.ts` switches to v6 only when `CITY_COST_METHODOLOGY_V6=true`; v1 remains the default.
- v6 provenance is persisted in `city_estimates.metadata_json` and shown on `/dataset`. The live CSV and seed path
  are unchanged.

### M3 — fit and validate

- [ ] Fit source-calibration offsets (gate 8: ≥12 cities, must reduce held-out median APE)
- [ ] Score gates 1–10 per tier, per region, per band
- [ ] Reveal the locked holdout **once**; report results unmodified
- [ ] Write the methodology and data card

**Exit:** all gates scored and reported, including any that fail and why.

### M4 — migrate

- [ ] Regenerate all 121 cities through v6 with grades
- [ ] A/B diff report against the current CSV, per tier and per city
- [ ] Rollback tested
- [ ] Switch the flag

**Exit:** v6 is the shipping path with a tested rollback.

### M5 — improve weak grades — ongoing

- [ ] `accom_1_star` — interpolated, zero direct evidence, weakest number in the ladder
- [ ] Hostel dorm/private split — the v4 channel could not distinguish them
- [ ] Activity semantics — BudgetYourTrip measures reported spend, not ticket prices
- [ ] Dorm coefficient — currently mixes a 2023 index with a current anchor; the v2 ground-truth panel
  repeatedly records dorm/3-star above the fitted band across multiple cities, strengthening the stale-index
  finding without authorising a refit during M2

---

## Open product decisions

Each has a stated default so no work is blocked waiting for an answer. Full context in
[`docs/dev/plans/city-cost-methodology-v6.md`](docs/dev/plans/city-cost-methodology-v6.md) §8.

| # | Decision | Default if unanswered |
| --- | --- | --- |
| 1 | Six accommodation tiers, or merge `accom_1_star` into a budget band? | Keep six; ship 1★ at grade C |
| 2 | How prominently is the grade shown in the UI? | Per-city badge + per-value tooltip, reusing the dashboard info-popover pattern |
| 3 | Refresh cadence | Re-measure levels quarterly; refit coefficients annually |
| 4 | Regenerate all 121 cities, or only new ones? | Regenerate at M4 behind the flag, with A/B diff and rollback |

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
