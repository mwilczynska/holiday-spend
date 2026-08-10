# Handoff — City Cost Methodology v6

**As at:** 10 August 2026
**Branch:** `feat/city-cost-methodology-v6`
**Milestone:** M0, **M1 (integrate)** and the original accommodation-scoped **M2 (ground truth)** are
complete. M3 was reopened by owner decision on 10 August 2026 and now means fit and holdout-validate all
19 product tiers. Independent all-tier collection is in progress; M4/M5 are out of scope.

> **This is the cold-start document.** If you are picking up this workstream with no context, you are in
> the right place. Read §1, then do §4. You do not need to read the 95 v5 experiment directories.

---

## 1. What this workstream is, in sixty seconds

The app needs 19 cost values per city (accommodation ×6, food ×4, drinks ×5, activities ×4), stored in
AUD for two travellers. The shipping path is **v1**: it asks an LLM to recall prices and applies asserted
multipliers, one of which is measurably wrong by 38.8%.

**v5 tried to replace it and failed** — 95 experiments, zero fields mapped. Not through bad execution;
its acceptance rule required metadata (explicit occupancy, tax basis, one-room wording, all in one
snippet) that commercial travel sites do not publish, and a per-relationship sample size (30 matched
cities) that public sources cannot reach. It also forbade shipping anything until those gates passed, so
nothing ever shipped.

**v6 keeps v5's evidence and replaces its acceptance rule.** Measure one level per category, derive the
rest from fitted ratios, grade every value A–D, attach an interval, and ship. Integrate first, improve
grades after.

The decisive fact: v5's own pooled evidence fits the accommodation ladder at **11.4% and 13.0%**
leave-one-out error and **replicates v4's independent fit to within 2–3%**. v5 rejected that fit eleven
times for sample size. The accuracy its gate protected was already achieved.

---

## 2. Read these, in this order

| # | File | Why |
| --- | --- | --- |
| 1 | This file | Orientation and the exact next action |
| 2 | `PLAN.md` | Milestones, open decisions, gate summary |
| 3 | `docs/dev/plans/city-cost-methodology-v6.md` | The methodology. §1 is the v5 diagnosis; §3 is the architecture |
| 4 | `data/reference/v6/data-dictionary-v6.md` | Frozen estimands + what grades A/B/C/D mean |
| 5 | `data/reference/v6/validation-manifest-v6.json` | Frozen gates + the 40-city panel and locked holdout |
| 6 | `data/reference/v6/coefficients-v6.json` | The fitted ladder, with provenance and caveats per number |
| 7 | `LOOP-PROMPT-V6.md` | The autonomous work prompt — **§5 stopping rules are mandatory** |
| 8 | `CLAUDE.md` | Project memory |

**Do not** read `data/reference/v5/experiments/*` in bulk. Those 95 directories are summarised in
`LOG.md` and `data/reference/v6/README.md`. Open a specific one only when you need its raw rows.

---

## 3. State of the world

### Current owner directive — 10 August 2026

The previous item-level M3 collection/scoring approach is **stopped and superseded**. It collected truth
without generating the matching production predictions, so its `not_evaluable` holdout result was structural.
The 25-city development ledger is intact at **280 found / 0 pending** across 18 measures and must not be
recollected. The previous holdout is spent: all 18 measures are `revealed_once`; do not inspect, rescore,
refreeze or tune from it.

The paired development route is now complete. Experiment 006 contains 75 schema-validated delegated spine
responses and 75 telemetry records for all 25 cities; 15 Expedia responses are byte-identical reuses from
experiment 001. Stage B runs the shared `materializeCityCostV6` implementation and produced 25/25 full
19-tier bundles. Experiment 005 is the deterministic **IN-SAMPLE** score: 9 evaluable tiers (six genuine
accommodation tiers plus three food tiers), one definitional tier, 8 blocked tiers, and one explicitly
not-evaluable activity tier. Gates 3–6 are explicitly `not_evaluable` because the development truth lacks a
complete independent daily basket. This is not holdout validation.

The six accommodation results remain genuine: medAPE ranges from 8.27% (3-star) to 25.46% (dorm). Food is
scored only where source Numbeo anchors are observed: budget n=14, mid n=13 and high n=13. Budget excludes
Singapore, Taipei, Colombo, Mumbai, Istanbul, Dubai, Cairo, Cape Town, Nairobi, Prague and Lima; mid/high
also exclude Budapest. The earlier food numbers are superseded as BYT-region-median-versus-BYT-city circular
comparisons. The 25 official attraction rows are preserved ticket observations, not daily-spend truth; the
previous activities-budget score is withdrawn, and all three activity tiers are not independently evaluable.

The measured street-food R0 `k=0.3248`, n=6, with a ±336% LOO-p90 interval is diagnostic only. The uniform
minimum fitted n=8 rule means production uses the generated global direct-evidence prior ratio `k=0.2757`
at grade D ±45%; premium n=3 remains the parallel grade-D 1.5 fallback. The prior artifact explicitly lists
the 34 frozen-FX exclusions.

The fresh holdout proposal remains `proposed_not_collected` with its 72/90 coverage gate. Do not collect,
freeze or read it without owner approval. M4 remains out of scope.

### Done (M0 + M1, 9 August 2026)

- Repo hygiene: `AGENTS.md` had a resume prompt accidentally appended and had drifted from `CLAUDE.md`,
  so `npm run docs:check-memory` was failing. Repaired.
- Experiment 095 committed with a `verdict.md` recording that it was **pre-registered but never executed**
  — no calls, no responses, no results. It must never be cited as evidence.
- v6 methodology, data dictionary, validation manifest and coefficients written and frozen.
- `scripts/fit-city-cost-ladder-v6.mjs` added; ladder fitted and reproducible via `--check`.
- `LOOP-PROMPT-V6.md` written; v5's loop prompt archived at `docs/dev/archive/loop-prompt-v5.md` with a
  banner explaining why it could not terminate.
- v5 plan doc and handoff bannered superseded; v5 programme closure appended to `LOG.md`.
- v6 deterministic materialization added in `src/lib/city-cost-methodology-v6.ts`: JSON-driven
  accommodation ladder, regional/band grade-D priors, worst-grade baskets and intervals.
- Three versioned v6 spine prompts and `src/lib/city-cost-v6-collection.ts` added. The collector preserves
  source currency and missingness, converts with the frozen FX snapshot, retries a block once, and records
  per-call telemetry within the six-call/25-search budget.
- `CITY_COST_METHODOLOGY_V6=true` switches new-city generation to v6; unset retains v1. The 121-city CSV and
  seed path are unchanged.
- v6 grades, intervals, missingness and telemetry are persisted in estimate metadata and shown on `/dataset`.
- 10 v6 tests cover materialization, priors, collection retry/FX, and the flagged generation path. The full
  suite passes with 153 tests; build, TypeScript and coefficient checks pass.
- The original M2 development ledger was accommodation-scoped. At the contract-reset checkpoint in `4cf397b`,
  it correctly reported **25 found / 125 pending / zero accommodation cities**; that is historical, not the
  current count. The all-19 M3 contract is `city-cost-v6-ground-truth-ledger-v4`: 25 cities x 18 measures.
  The first independent tranche is complete: 25/25 `hotel_2star_room_2p` rows were collected from logged-out
  Booking.com under `booking_top_picks_firstpage_median_v2`, including sample prices and inventory counts.
  Current coverage before the street-food amendment was **269 found / 0 pending**. Batch 001 resolved all ten independent food/drink/activity
  measures for Hanoi, Ho Chi Minh City, Da Nang, Phuket, Singapore and Taipei; batch 002 resolved the same ten
  measures for Beijing, Tokyo, Seoul, Delhi, Colombo and Mumbai; batch 003 resolved the same ten measures for
  Istanbul, Dubai, Cairo and Cape Town; and batch 004 resolved the same ten measures for Nairobi, Budapest,
  Prague and Lisbon; batch 005 resolved Barcelona, Mexico City, Lima, San Francisco and Melbourne. Batch 005
  added 17 found rows and 33 explicit missingness rows. Every 25-city x 17-measure development slot now has
  either a compliant independent observation or an explicit missingness status.
- Batch 006 added the independent `street_food_meal_1p` slot. It has 11 found rows, 14 explicit `not_found`
  rows and zero `class_absent` findings. The amended ledger is now **280 found / 0 pending** across 25 cities
  x 18 measures.
- The original 15-city six-measure holdout is in `data/reference/v6/ground-truth/holdout-ledger.json` and is
  spent. Batch 007 collected the fresh 12-measure extension at 12 found / 168 explicit `not_found` rows,
  then sealed it. One candidate was frozen before the extension was read. The extension was read exactly once
  by `score-city-cost-v6-holdout-all-tier.mjs`; it did not reopen the six old measures. Its gates 2-6 are
  explicitly `not_evaluable` because no paired production-path prediction bundle exists and the old values
  cannot be used to build a full basket. Do not tune or rescore.

### Current collection findings

The fixed-count `booking_price_asc_median_v1` rule is superseded. It sampled the price floor for deep
3/4-star inventories and a much deeper percentile for shallow 1-star/hostel inventories, so its ratios were
not comparable across classes. The v2 replacement is
`booking_top_picks_firstpage_median_v2`: Booking's default Our top picks order, every eligible first-page
price, and the displayed class inventory count.

The two-city v2 pilot was verified and the revised artifact-signature rule then authorized continuation.
Hanoi medians are 4*/3*/1*/private/dorm = **62/42/27/32/10 AUD**; Singapore =
**182/118/73/99/39 AUD**. The private-hostel/1-star inversion holds in the same direction in the pilot,
so it remains a candidate M5 ladder correction. Dorm/3-star remains above the fitted 0.163 band across
multiple cities, strengthening the stale 2023 Price of Travel coefficient finding; do not refit during M2.

The earlier stop on Delhi **0.941** and Prague **0.931** is superseded. Across the 19-city v2 panel, the
4-star/3-star ratios form a continuous distribution with median 1.404; those two near-parity values are
dispersion, not an artifact signature. The owned decision procedure is: record and continue by default;
mark an artifact candidate only for a class-order violation exceeding 25%, a within-city ratio that
correlates with `classInventoryCount` across the batch, or an implausible 3-star level below A$10 or above
A$400; stop and report only when candidates exceed 30% of the cities in a batch. Individual outliers do not
stop collection.

All 25 development cities now have accommodation rows under `booking_top_picks_firstpage_median_v2`,
explicit statuses for the ten independent food/drink/activity measures, and the independent street-food row.
The amended all-tier development collection panel is resolved; the all-19 holdout validation is not.
The 25-city ladder result and six-city refresh are recorded in `PLAN.md` and `LOG.md`: 4-star and 1-star
remain confirmed, and dorm was refit from the development medians. The private development diagnostic was
0.7955, but the one-time holdout implied roughly 0.603 and showed uniform over-prediction; the generator now
ships a pre-holdout v4-blended rollback of **0.5919 ±35%**. This is a rollback, not a holdout fit, and the
private rung is now the primary cost-banded R1 M5 candidate rather than an independent holdout test. The
Booking → Expedia offset was fitted on 15 matched development cities (above the 12-city minimum), then frozen
with the scored candidate. San Francisco's A$537 3-star median remains a flagged absolute-level row. The
first-page bias caveat is documented in the ground-truth README and both ledger `sourcePolicy` objects: this
panel supports ratios and source calibration, not absolute city levels.

### The coefficients that exist right now

```
accom_2_star              = 0.7500 × accom_3_star    n=18  LOO 11.37%  grade C  ±25%
accom_4_star              = 1.3372 × accom_3_star    n=26  LOO 12.98%  grade C  ±25%
accom_1_star              = 0.6663 × accom_3_star    INTERPOLATED       grade C  ±45%
accom_hostel_private_room = 0.5919 × accom_3_star    v4 blended rollback   grade C  ±35%
accom_shared_hostel_dorm  = 2 × 0.2955 × accom_3_star  Booking v2, n=25   grade C  ±54%
street_food_meal_1p       = 0.2757 × inexpensive meal global prior fallback, grade D  ±45% (diagnostic R0 0.3248, n=6, ±336%)
```

The current shipped coefficient is the v4-blended rollback. The frozen candidate used for the single holdout
score was 0.7955; its private-room result is therefore not a test of the current coefficient. The development
and holdout disagreement is evidence for a cost-banded R1 form: the development panel skews major-metro,
while the holdout skews smaller and more touristic, where private rooms can be genuinely budget-priced. Dorm
0.2955 remains below 1-star and the stale 2023 dorm coefficient is superseded.

**`accom_1_star` is the weakest number in the methodology.** It has zero direct observations — 15 v5
experiments and roughly 150 one-city calls produced none, and the 101 pooled Expedia rows contain zero
one-star rows. It is the geometric mean of the hostel and two-star coefficients. See open decision 1.

### Not done

The historical accommodation-only candidate and single gate 2–6 score are retained, and experiment 001 has
accepted the fresh production-anchor replication. They are not the all-19 M3 result. The item-level
development ledger remains **280 found / 0 pending**. Experiment 006 now supplies the paired production
prediction bundle at 25/25 cities; experiment 005 reports the development-only score as 9 evaluable tiers,
one definitional tier, 8 blocked tiers and one not-evaluable activity tier. Gates 3–6 are not evaluable on the
partial development truth.
The v6 path is integrated but opt-in. The 121-city CSV and default v1 path remain untouched.
**The 121-city CSV and the default v1 generation path remain untouched and still shipping.** Local provider
API keys are absent; the delegated GPT-5.6 Luna test path produced the experiment responses.

The last reporting gap is documented in `holdout-scores.json`: the shipped configuration hash
`sha256:8b0c75af42f631be7f926d217a0adc1aa45d734ef3fb852594ab23addef47a63` differs from the sealed score hash
`sha256:bbd581154a657ccc0ffaf0b3a9ca3bac289564c0c9f8c5a53226785c094d2cde`, because private was rolled back
to `0.5919` after the one-time score. The private score rows describe the superseded `0.7955` candidate.

Experiment 001 (`data/reference/v6/experiments/001-expedia-production-anchor/`) collected 15/15 observed
Expedia 3-star responses in 15 calls and 52 searches, with zero blocks and zero direct page reads. Against
the Booking development anchors, the frozen FX snapshot and Expedia→Booking `0.9361` offset produced median
APE **8.36%** and median signed error **+7.08%**; the preregistered verdict is **accept**. The checked ECB
rate differs from the frozen USD→AUD snapshot by only 0.66%; the frozen rate remains primary for reproducibility.

---

## 4. Historical next action (superseded 10 August 2026)

1. Inspect `data/reference/v6/experiments/007-production-prediction-bundle-initial/results.json`. It is a
   deterministic audit of the production path, not a substitute for predictions. Run
   `cmd /c node scripts/generate-v6-prediction-bundle.mjs` with the same provider/model resolution as
   production once credentials are available; retain explicit `not_run` rows on failure.
2. Pre-register and write `data/reference/v6/experiments/003-budgetyourtrip-tier-panel/`. For each of
   the 25 development cities, capture BudgetYourTrip's per-person/day budget, mid-range and high-end food
   and entertainment/activity tiers, with label, currency, URL, retrieval date and evidence text. Mark
   activity rows as production-source/unvalidated, not independent truth. Add a separate Expatistan drink
   experiment for cocktail and neighbourhood-pub beer; do not collect wine glass after the rejected bottle
   calibration route.
3. Extend the coefficient generator. Set the minimum fitted relation sample size to a documented threshold
   (use `n >= 8`); below it, ship a reasoned constant or regional prior with an honest grade and residual
   interval. Replace street food's unusable n=6 fit with the owner-directed `0.5 × inexpensive meal`,
   grade C, ±35%, and audit every food/drink/activity grade against actual evidence.
4. Replace the CSV-inversion prior builder with a generated prior artifact built from direct development
   observations and tier-level evidence. Preserve region → region|band → global fallback, and do not modify
   `data/reference/city_costs_app_aud.csv`.
5. Score only the development panel, labelled **IN-SAMPLE**. Report evaluable and blocked tiers separately;
   do not call this a holdout result.
6. Before any new holdout action, verify which of the 81 neither-panel cities have confirmed city-scoped
   BudgetYourTrip pages. Add the minimum found-row coverage gate to
   `freeze-city-cost-v6-candidate.mjs`, propose a stratified 15-city draw and its coverage numbers, then
   stop and request owner approval. Do not collect, freeze or read that holdout in this phase.

The old holdout, all 18 `revealed_once` measures, and the 121-city CSV are out of scope. M4 is out of scope.

## 4. The exact next action

1. Treat experiment 006 and `data/reference/v6/experiments/005-development-in-sample-score/results.json`
   as the current development record. The prediction bundle is 25/25 and the score is explicitly in-sample:
   9 evaluable tiers, one definitional tier, 8 blocked tiers and one not-evaluable activity tier. Food scores
   are budget n=14, mid n=13 and high n=13; use the recorded exclusion lists. Do not relabel any number as
   holdout validation.
2. If the bundle is regenerated, use the default from-disk path:
   `cmd /c node scripts/generate-v6-prediction-bundle.mjs`. It must read the 75 raw response files and 75
   telemetry files under experiment 006, validate the existing spine schema, and call the shared
   `materializeCityCostV6` function. `--provider=<name>` is the opt-in direct-provider mode.
3. The materializer regression and observed-anchor score are already committed. If this route is changed,
   run the verification baseline, then append confirmed results to `PLAN.md` and `LOG.md`. Regenerate
   `priors-v6.json` before `fit-city-cost-ladder-v6.mjs --check`; do not hand-edit coefficients. The measured
   street-food n=6 relation is diagnostic only; the shipped fallback is generated k=0.2757, grade D ±45%.
4. The fresh proposal remains `data/reference/v6/ground-truth/fresh-holdout-proposal-v2.json` with a 72/90
   minimum coverage gate. **Stop and obtain owner approval before collecting, freezing or reading it.** Do
   not touch the spent holdout or any `revealed_once` measure.

---

## 5. Traps that will cost you time if you forget them

1. A model's explanation for a failure is a hypothesis. Verify it independently — usually one command.
2. Most apparent "model unreliability" in v3/v4/v5 was contract defects. The model usually obeyed
   correctly and the instruction was wrong.
3. Never ask the model to grade its own work. v4 found self-reported confidence wrong in every run, and
   always flatteringly.
4. A contract that fights the shape of its sources will lose. This is what killed v5.
5. Inspect the underlying record, not your own summary.
6. On rate limiting, defer the city. Never silently fall through to a lower-quality source.
7. Do not adopt a result from one city's evidence.
8. **An unreachable gate is a defect in the gate.** Before spending an experiment on a gate, check
   whether anything has ever passed it.

---

## 6. Environment notes

- **The repo lives inside OneDrive.** Files On-Demand dehydrates idle files into cloud placeholders that
  Node reports as symlinks, which makes Next's `recursiveDelete` die with
  `EINVAL: invalid argument, readlink '...\.next\server\app\estimates'`. `next dev` then exits 0 and
  looks like an app crash with no application code involved. Fix: delete `.next`, then
  `attrib +P -U /s /d` at the repo root. A fresh clone or OneDrive reset brings it back.
- Provider API credentials are **not** configured locally. This is not a blocker: delegated GPT-5.6
  Luna-class sub-agents are the target-model test path. Provider telemetry is a separate concern.

---

## 7. Verification

```
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
node scripts/fit-city-cost-ladder-v6.mjs --check
```

`/api/export` is dynamic because it reads request headers — that build note is expected.

---

## 8. Before you finish a work cycle

1. Record progress in `PLAN.md`.
2. Append confirmed results to `LOG.md`.
3. **Rewrite §3 and §4 of this file** so the next cold agent knows the state and the exact next action.
   A handoff that says "continue the work" has failed.
4. Commit and push.
