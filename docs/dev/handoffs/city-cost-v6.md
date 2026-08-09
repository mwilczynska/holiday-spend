# Handoff — City Cost Methodology v6

**As at:** 9 August 2026
**Branch:** `feat/city-cost-methodology-v6`
**Milestone:** M0 and **M1 (integrate) complete**. **M2 (ground truth) is in progress.**

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
- The M2 ledger is in `data/reference/v6/ground-truth/development-ledger.json` and now uses
  `city-cost-v6-ground-truth-ledger-v2`. At the contract-reset checkpoint in `4cf397b`, it correctly
  reported **25 found / 125 pending / zero accommodation cities**: the attraction tranche remained and every
  accommodation slot was reopened because the old single-property, pre-correction captures were invalid.
  The current post-recollection state is **55 found / 95 pending**: 25 attraction rows and 30 corrected
  Booking.com accommodation rows across Hanoi, Ho Chi Minh City, Da Nang, Phuket, Singapore and Taipei.
  `holdout-seal.json` remains a lock marker only; no holdout prices or scores were used.

### Current collection findings

The corrected six-city panel is useful for auditing the collection contract but is not a coefficient-fit
panel. The fixed-price-basis recollection removes the apparent 1-star and class-ratio failures caused by
Booking.com strikethrough anchors. One genuine signal remains: the dorm rung is still materially higher
than the fitted coefficient in this panel (roughly 2× against the fitted 0.163 ratio). Record this as an
M5 dorm-coefficient finding; do not refit or score it during M2.

The nine known attraction-estimand violations were replaced with standard adult general-admission museum
or historic-site rows: Da Nang, Melbourne, Taipei, Beijing, Barcelona, Budapest, Prague, Phuket and Delhi.

### The coefficients that exist right now

```
accom_2_star              = 0.7500 × accom_3_star    n=18  LOO 11.37%  grade C  ±25%
accom_4_star              = 1.3372 × accom_3_star    n=26  LOO 12.98%  grade C  ±25%
accom_1_star              = 0.6663 × accom_3_star    INTERPOLATED       grade C  ±45%
accom_hostel_private_room = 0.5919 × accom_3_star    v4 blended, n=13   grade C  ±35%
accom_shared_hostel_dorm  = 2 × 0.1626 × accom_3_star  n=7, 2023 index  grade C  ±40%
```

Ordering sanity check: dorm 0.325 < private 0.592 < 1★ 0.666 < 2★ 0.750 < 3★ 1.000 < 4★ 1.337. Monotonic.

**`accom_1_star` is the weakest number in the methodology.** It has zero direct observations — 15 v5
experiments and roughly 150 one-city calls produced none, and the 101 pooled Expedia rows contain zero
one-star rows. It is the geometric mean of the hostel and two-star coefficients. See open decision 1.

### Not done

The M2 source-fact collection and M3–M5 remain. The v6 path is integrated but opt-in. **The 121-city CSV and the default v1 generation path remain
untouched and still shipping.** A live provider smoke test requires a configured provider key; the flagged
path is covered by deterministic integration tests.

---

## 4. The exact next action

**Next exact action: re-collect Beijing’s five accommodation measures under the v2 contract.** Do not tune
coefficients, fit the Booking → Expedia offset, score gates or open the locked holdout. The current ledger
has 25 found attraction rows plus 30 corrected accommodation rows, leaving 95 pending slots for the frozen
reference window 2026-09-17 to 2026-09-18. The six-city accommodation rows use the logged-out Booking.com
price-ascending median rule and v2 provenance fields. Beijing and Tokyo’s old accommodation rows are
historical only and were removed in `4cf397b`; Beijing must be collected afresh, not patched.

The contract-reset checkpoint immediately before recollection was **25 found / 125 pending / zero
accommodation cities**; do not mistake that historical checkpoint for the current ledger state.
Preserve the same evidence standard for the next city: exact dates, class or hostel identity, occupancy,
display currency, price basis and tax treatment. Record as `amount` the lowest price a logged-out visitor
with no membership is quoted for a room meeting the class and occupancy spec for the frozen window. Public
promotional deals available to any visitor (Getaway Deal, Early Booker, Bonus savings and seasonal sales) are
transactable and included; membership-gated rates (Genius and VIP reward tiers) are excluded. Never record a
strikethrough or "original" price as `amount`.

The property selection rule is `booking_price_asc_median_v1`: on the city-scoped Booking.com results page,
use 2 adults / 1 room (1 adult / 1 room for a dorm), filter to the star class or Hostel, sort by Price
ascending, take the first 10 eligible listings, and record all 10 prices; `amount` is the median. If 10 are
not available, use at least 3 and use that same count for every class in the city. Never use one listing.

Work order for the next agent:

1. Use `data/reference/v6/ground-truth/development-ledger.json` as the only development write target and
   keep the 15 holdout city results sealed in `ground-truth/holdout-seal.json`.
2. On Booking.com, use the frozen dates and the logged-out `booking_price_asc_median_v1` rule for Beijing’s
   dorm, private hostel, 1-star, 3-star and 4-star measures. If a class is absent, record explicit
   missingness; never turn a tool limitation into a source-level block.
3. Run `node scripts/validate-city-cost-v6-ground-truth.mjs` and keep the 12-city minimum before fitting
   the Booking → Expedia source offset. The deleted-row regression is already committed in `6d74fdb` and
   the attraction repair is already committed in `34a1045`.
4. Append the next dated M2 verdict to `LOG.md`, then update this section with the next exact city/action.
   Do not use the locked holdout to tune a prompt, coefficient or gate.

**M2 exit criterion:** all 25 development cities and 15 locked holdout cities have the six required facts,
metadata and sealed storage; no holdout score has been revealed. The current ledger is not at exit: it has
55 found observations and 95 pending slots.

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
