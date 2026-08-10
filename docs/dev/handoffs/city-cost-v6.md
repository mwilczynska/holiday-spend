# Handoff — City Cost Methodology v6

**As at:** 9 August 2026
**Branch:** `feat/city-cost-methodology-v6`
**Milestone:** M0, **M1 (integrate)**, **M2 (ground truth)** and the M3 development refit, source calibration,
candidate freeze and single holdout score are complete. Remaining M3 segments and M4/M5 are open.

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
- The M2 development ledger is in `data/reference/v6/ground-truth/development-ledger.json` and uses
  `city-cost-v6-ground-truth-ledger-v2`. At the contract-reset checkpoint in `4cf397b`, it correctly
  reported **25 found / 125 pending / zero accommodation cities**: the attraction tranche remained and every
  accommodation slot was reopened because the old single-property, pre-correction captures were invalid.
  The completed development state is **147 found / 3 explicit `class_absent` / zero pending** across all
  150 cells: 25 attraction rows and 122 v2 Booking.com accommodation rows. Beijing, Nairobi and Melbourne
  have explicit one-star `class_absent` rows.
- The 15-city holdout is collected into `data/reference/v6/ground-truth/holdout-ledger.json` and was scored
  exactly once after the candidate freeze. `holdout-seal.json` is now `revealed_once` and points to the separate
  `ground-truth/holdout-scores.json`; the holdout ledger itself has no score fields. Do not tune or rescore.

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

The six remaining development cities — Lisbon, Barcelona, Mexico City, Lima, San Francisco and Melbourne —
were collected under `booking_top_picks_firstpage_median_v2`. The full development panel is resolved.
The 25-city ladder result and six-city refresh are recorded in `PLAN.md` and `LOG.md`: 4-star and 1-star
remain confirmed, while the old private and dorm coefficients were refit from the development medians. The
Booking → Expedia offset was fitted on 15 matched development cities (above the 12-city minimum), then frozen
with the candidate. San Francisco's A$537 3-star median remains a flagged absolute-level row. The first-page
bias caveat is documented in the ground-truth README and both ledger `sourcePolicy` objects: this panel supports
ratios and source calibration, not absolute city levels.

### The coefficients that exist right now

```
accom_2_star              = 0.7500 × accom_3_star    n=18  LOO 11.37%  grade C  ±25%
accom_4_star              = 1.3372 × accom_3_star    n=26  LOO 12.98%  grade C  ±25%
accom_1_star              = 0.6663 × accom_3_star    INTERPOLATED       grade C  ±45%
accom_hostel_private_room = 0.7955 × accom_3_star    Booking v2, n=25   grade C  ±52%
accom_shared_hostel_dorm  = 2 × 0.2955 × accom_3_star  Booking v2, n=25   grade C  ±54%
```

The frozen candidate preserves a known private-room/1-star ordering inversion (0.7955 > 0.6663); it is a
candidate M5 ladder decision, not a reason to alter the frozen candidate or rescore the holdout. Dorm 0.2955
remains below 1-star and the stale 2023 dorm coefficient is superseded.

**`accom_1_star` is the weakest number in the methodology.** It has zero direct observations — 15 v5
experiments and roughly 150 one-city calls produced none, and the 101 pooled Expedia rows contain zero
one-star rows. It is the geometric mean of the hostel and two-star coefficients. See open decision 1.

### Not done

The M3 candidate and single gate 2–6 score are complete; remaining M3 segments, M4 and M5 remain. The v6 path is integrated but opt-in. **The 121-city CSV and the default v1 generation path remain
untouched and still shipping.** A live provider smoke test requires a configured provider key; the flagged
path is covered by deterministic integration tests.

---

## 4. The exact next action

M2 is complete and the M3 candidate/holdout score is frozen. Do not recollect the development panel, refit
`coefficients-v6.json`, fit another offset, or rescore/open additional holdout detail from this handoff. The
development ledger contains 147 found rows, three explicit one-star `class_absent` rows and zero pending
slots; the holdout ledger contains 15 cities × 6 measures and was scored once under the frozen candidate.

The candidate-freeze transition and the one-time holdout read are complete. The exact next action for a cold
resume is to preserve the scored result and move to the remaining M3/M4 decision work; do not rerun scoring.

1. Preserve the frozen candidate hash `sha256:bbd581154a657ccc0ffaf0b3a9ca3bac289564c0c9f8c5a53226785c094d2cde`
   and base commit `f52be517359c51d878e667673918e88487e6199d` in `ground-truth/holdout-seal.json`. The seal is
   now `revealed_once`; its score file is `ground-truth/holdout-scores.json`.
2. Keep private `0.7955 ±52%`, dorm `0.2955 ±54%`, confirmed 4-star/1-star unchanged, and the
   Expedia→Booking runtime offset `0.9361 ±41%`. Do not change any candidate component after the holdout read.
3. Preserve the single score: gate 2 fails private-room signed error, gate 3 accommodation ranking passes,
   gate 4 exact band agreement fails at 73.33%, gate 5 is not evaluable, and gate 6 is only partial because
   the six-measure panel cannot assess 15/19 full product tiers. Gate 8 is not holdout-evaluable because no
   paired Expedia rows were collected in the holdout.
4. Run verification only. Never tune, rescore, or inspect additional holdout detail. The next authorized
   workstream is the remaining M3/M4 decision and migration work, not another M2 or holdout collection pass.

The contract-reset checkpoint immediately before recollection was **25 found / 125 pending / zero
accommodation cities**; it is historical and must not be reported as the current state. The v2 rows use
Booking's default top-picks order, record every eligible first-page price and `classInventoryCount`, and use
the documented public-promotion price basis. The first-page level-bias caveat means these medians are valid
for ratios and source calibration, not absolute city-level ground truth.

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
