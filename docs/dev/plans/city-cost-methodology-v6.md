# City Cost Methodology v6 — Ship the Ladder, Label the Confidence

**Status:** **ACTIVE.** Adopted 9 August 2026. Supersedes `city-cost-methodology-v5.md`.
**Branch:** `feat/city-cost-methodology-v6`
**Current milestone:** M0, M1 and M2 collection are complete; M3 has been reset to fit and validate all 19
tiers end-to-end. The previous holdout is spent and all 18 measures are `revealed_once`; no new holdout may
be drawn, frozen or read until Phase 6 proposes a coverage-qualified panel and the owner approves it. M4 is
intentionally not started.

**Cold start?** Read `docs/dev/handoffs/city-cost-v6.md` — it names the exact next action.
**Running the loop?** Use `LOOP-PROMPT-V6.md`.

v5 is not discarded. v6 keeps its data dictionary, its derivation contract, its provenance model, and
almost all of its collected evidence. What v6 replaces is the **acceptance rule** — the definition of
when the methodology is allowed to ship.

---

## 1. Why v5 could not terminate

v5 ran **95 experiments** and accepted zero product mappings. That is not an execution failure. The
experiments are well designed, honestly scored, and the evidence they produced is the foundation of v6.
The failure is in the objective function: **v5 was given a termination condition it could not reach, and
forbidden from shipping anything until it did.**

Five mechanisms, each independently sufficient to prevent termination.

### 1.1 The estimand demanded metadata that commercial sources do not publish

The frozen accommodation estimand requires, *in the same evidence*: exact city, explicit star class,
explicit two adults, explicit one room, a non-`from` nightly price, named currency, reference period, and
stated tax treatment. Eight facts co-occurring in one snippet.

Nearly every rejection is a **metadata** failure, not a **price** failure. Experiment 052 is the cleanest
case — 0/12 strict, and the verdict records that most candidates "had class, price, and tax but no explicit
one-room occupancy." The number was on the page. The label was not.

Commercial travel sites publish prices to sell rooms, not to support estimation. They will never
systematically emit occupancy-basis metadata, because no commercial incentive produces it. A contract that
requires it is not strict — it is **unsatisfiable**, and 61 accommodation experiments is the cost of
discovering that empirically rather than deciding it structurally.

### 1.2 The sample-size gate was unreachable by construction

Every material relationship required 30 matched cities plus 10 locked holdouts — 40 cities where *both*
sides of the ratio are observed.

Expedia received **eleven dedicated panels** (028, 029, 059–063, 075, 078, 085–088), roughly 130 one-city
calls. Pooled result: 101 rows, 51 cities, but only **18 matched 2↔3 and 26 matched 3↔4**. The last four
panels added *zero* new matched 2↔3 pairs. That is an asymptote, not a slope — precisely the "attrition is
a cliff, not a slope" finding v4 had already documented and v5 re-derived at ten times the cost.

The gate could not be met, so nothing could be fitted, so the loop collected more.

### 1.3 The accuracy the gate protected was already achieved

This is the decisive finding, and it was available in the repo the whole time.

Pooling all Expedia panels and fitting the single-parameter global median ratio (R0), scored
leave-one-out at city level:

| Relation | Matched cities | Median ratio | R0 LOO median APE | R0 LOO p90 APE | v5 gate |
| --- | --- | --- | --- | --- | --- |
| `accom_2_star ← accom_3_star` | 18 | 0.750 | **11.4%** | 24.6% | ≤25% / ≤50% |
| `accom_4_star ← accom_3_star` | 26 | 1.337 | **13.0%** | 27.2% | ≤25% / ≤50% |

Both clear the gate with roughly a factor of two in hand. And they **replicate v4's independent fit** from
a different source (Booking.com), a different estimator (first-page property median vs class-trend
average), a different year, and a largely different city sample:

| Relation | v4 / Booking.com (n=16) | v5 / Expedia (n=18–26) | Agreement |
| --- | --- | --- | --- |
| `2★/3★` | 0.734 | 0.750 | 2.2% |
| `4★/3★` | 1.297 | 1.337 | 3.1% |

Cross-source replication at this tolerance is **stronger** evidence of generalisation than a larger
single-source sample. The 30-city gate was a proxy for "does this relationship transfer?" — and the answer
had already arrived by a better route. v5 rejected the fit eleven times for sample size while holding the
evidence that made sample size moot.

### 1.4 Fail-closed was wired to the product instead of to the label

"A modelled value must never be presentable as observed evidence" is correct and must survive into v6. But
v5 implemented it as *no value ships unless every anchor is observed*. Since no route achieves complete
anchor coverage, `complete` is false for every city, and nothing ever ships.

The consequence is an inversion. The live dataset is still **v1** — 100% asserted, uncalibrated, with a
known-refuted multiplier (`accom_4_star = hotel_3star × 1.80`, refuted at 38.8% median absolute error
against 16 cities). Every v5 experiment that "failed" left the user strictly worse off than shipping a
clearly-labelled approximation would have. **The purity rule protected the methodology's reputation at the
cost of the user's data.**

Honesty is a property of the *label*, not of the *coverage*. A number marked "modelled from a 3-star
anchor, ±25%" is honest. A blank is not more honest — and in this app a blank means the planner silently
falls back to v1's asserted constants, which is *less* honest.

### 1.5 The one-call constraint bought little and cost much

The stated rationale (CLAUDE.md) is refresh economics: "a method costing thousands of lookups per refresh
will never be re-run." Correct. But "one LLM request per city" is a poor operationalisation.

A 121-city refresh at 4 cheap-model calls per city is ~484 calls — a handful of dollars, once. The one-call
rule saves perhaps A$10 per full refresh, and in exchange it forbids:

- **category specialisation** — yet the evidence chose specialists anyway (Numbeo for food/drink at 96%
  cell coverage, BudgetYourTrip for activities at 28/30 cities, Expedia for hotels). Experiment 090 tried
  to bundle all five sources into one call and got 8/12 on the easy anchors and 0/12 on the hard ones;
- **retry on a 429/503**, the single most common non-metadata failure across the whole programme;
- **a second sample**, which is how anchor dispersion gets controlled.

The constraint was optimising a cost that was never the binding one.

### 1.6 The proximate cause: `LOOP-PROMPT.md`

The untracked `LOOP-PROMPT.md` is an unusually rigorous research protocol, and it contains the trap
explicitly:

- *"Do not migrate the production dataset or wire v5 into the application until the methodology passes its
  gates"* — shipping is forbidden until an unreachable condition is met;
- *"Do not stop after ... partially solving one category. Continue selecting and executing the next
  highest-value experiment until the Definition of Done is satisfied"* — the loop cannot exit;
- *"Do not ... polish an already workable food model while accommodation or activities still prevent a
  complete result"* — the loop is **required** to spend its effort on the least tractable category.

That last instruction explains the distribution directly:

| Category | Experiments | Outcome |
| --- | --- | --- |
| Accommodation | **61 of 95** | no field mapped |
| Activities | 13 | no field mapped |
| Food / drink | 11 | route promoted, never mapped |
| Infrastructure / audit | 10 | derivation contract retained |

And within accommodation, **15 experiments (~150 city-calls) targeted `accom_1_star` alone** — one of
nineteen product fields — producing zero usable rows. The instruction to always attack the hardest blocker
first, combined with a blocker that is structurally unsolvable from public sources, is an infinite loop.

**`LOOP-PROMPT.md` must not be re-run against v6 unmodified.** §10.4 specifies its replacement.

---

## 2. What v6 changes

Five principle-level changes. Everything else is inherited.

| # | v5 | v6 |
| --- | --- | --- |
| 1 | Value ships only if every input is observed | **Every value ships, every value carries a grade** |
| 2 | Per-relationship gate: 30 matched cities + 10 holdout | **Product-level gates: tier accuracy, city ranking, trip total** |
| 3 | Exactly one LLM call per city | **A refresh budget: ≤6 calls, ≤25 searches, ≤A$0.15/city** |
| 4 | Row-level metadata or reject | **Source-level calibration; residual dispersion enters the interval** |
| 5 | Integrate only after acceptance | **Integrate first behind a flag; improve grades iteratively** |

### 2.1 The retained principles

Unchanged from v4/v5, and load-bearing in v6:

- **Measure level, model structure, re-measure only level.** v6 finally executes this instead of blocking on it.
- **The LLM is a structured extractor, never an estimator.** No arithmetic, no FX, no tier emission.
- **Deterministic derivation.** `deriveCityCostV5()` is kept as-is and becomes the v6 derivation core.
- **Distinct missingness states.** `not_found` / `blocked` / `stale` / `class_absent` stay distinct.
- **A modelled value is never presented as observed.** Enforced by grade, and now *visible in the UI*.

---

## 3. Architecture

```
                    ┌─────────────────────────────────────────┐
  city, country ──▶ │ SPINE: 3 specialist extractor calls     │
                    │  A  Numbeo search      → 5 food/drink   │  grade A
                    │  B  Expedia 3★ trend   → 1 hotel level  │  grade A/B
                    │  C  BudgetYourTrip     → 3 activity     │  grade B
                    │ (D  Expatistan         → 2 drink, opt)  │  grade B
                    └───────────────────┬─────────────────────┘
                                        │  source-currency facts only
                    ┌───────────────────▼─────────────────────┐
                    │ DETERMINISTIC (no LLM, existing code)   │
                    │  1. FX from dated table                 │
                    │  2. Source calibration offsets          │
                    │  3. LADDER: derive unmeasured anchors   │  grade C
                    │  4. Regional prior for anything absent  │  grade D
                    │  5. deriveCityCostV5() → 19 tiers       │
                    │  6. Grade + interval propagation        │
                    └───────────────────┬─────────────────────┘
                                        ▼
                        19 values, each with grade + interval
```

### 3.1 The spine — what is measured

Six anchors, chosen because the v5 evidence *already proved* they are cheaply and repeatably retrievable.

| Call | Source | Anchors | Evidence | Measured coverage |
| --- | --- | --- | --- | --- |
| **A** | Numbeo, search snippets only | `inexpensive_restaurant_meal_1p`, `midrange_restaurant_meal_2p`, `cappuccino_1`, `domestic_draft_beer_1`, `mcmeal_combo` | Exp 016–019, 022 | **144/150 cells (96%), 28/30 complete cities**; matched rows median APE 0%, p90 7.14% |
| **B** | Expedia 3-star class trend | `hotel_3star_room_2p` | Exp 028/029/059–063/075/078 | **43 cities with a 3★ anchor**; ~70% per-panel hit rate; explicitly two-adult, tax-excluded |
| **C** | BudgetYourTrip entertainment tiers | budget / mid / luxury per person/day | Exp 035, 036, 080, 081 | **28/30 complete cities**; **0% dispersion** across 3 repeat calls |
| **D** *(optional)* | Expatistan | `cocktail_1`, wine bottle | Exp 091, 092 | 10/12 and 12/12; cocktail cross-checked against independent menus (ratio 0.917) |

Direct page reads are **not** in the production path — Experiment 015 (HTTP 503/429) and Experiment 013
(all 15 URLs blocked) settled that. Search snippets only, which is what every high-coverage route used.

### 3.2 The ladder — what is derived

Nothing below is measured per city. Each is a fitted ratio applied to a measured spine anchor.

**v6.0 coefficients, from evidence already in the repo:**

```
accom_2_star          = 0.75 × accom_3_star     n=18  LOO 11.4%  p90 24.6%   [v4 cross-check 0.734]
accom_4_star          = 1.34 × accom_3_star     n=26  LOO 13.0%  p90 27.2%   [v4 cross-check 1.297]
accom_hostel_private  = 0.59 × accom_3_star     n=13  LOO 16.6%  holdout 36.6%   (v4 blended hostel)
accom_1_star          = 0.66 × accom_3_star     interpolated, hostel 0.59 < 1★ < 2★ 0.75 — grade C, weakest link
accom_shared_dorm     = 2 × dorm_bed;  dorm_bed/3★ fitted from Price of Travel index (Exp 072, 12/12 strict)

food tiers            existing deterministic baskets (deriveCityCostV5, unchanged)
mcmeal ~ inexpensive  R1 banded: k_low 1.7260  k_mid 1.0898  k_high 0.6452   (v4, n=68, LOO 22.0%)
cappuccino ~ beer     R1 banded: k_low 1.1304  k_mid 1.0614  k_high 0.6629   (v4, n=97, LOO 18.2%)
midrange ~ inexpensive R0: 5.7388                                             (v4, n=97, LOO 21.3%)

activities            BudgetYourTrip tier × 2 (deterministic, no fitted parameter)
activities_free       = 0, definitional
```

**Two coefficients are explicitly weak and labelled as such:** `accom_1_star` (interpolated, no direct
evidence in 15 experiments) and the dorm/private hostel split (v4's channel cannot separate them). They
ship at grade C with a wide interval and are the first targets of the M5 improvement cycle. Shipping them
labelled is strictly better than shipping v1's unlabelled asserted values, which is the live alternative.

**A negative result is preserved and respected.** v4 established that activities *cannot* be derived from
food prices — the `attraction ~ inexpensive` ratio spans 0.025 to 6.0, a 242× range, with every model at
47–58% median APE and unbiased-but-imprecise behaviour that is the signature of an absent relationship.
v6 does not model activities from food. It measures them directly from BudgetYourTrip (grade B) or falls
to a regional prior (grade D).

### 3.3 Source calibration replaces row-level metadata

v5's binary rule — the row states its occupancy basis or it is rejected — discarded most of the evidence
collected. v6 replaces it with a **source-level offset fitted once**:

```
value_calibrated = value_raw × offset[source, measure]
```

`offset` is fitted from the ground-truth panel (§5) against each source's raw output, and the residual
dispersion becomes that source's published interval width. Unknown occupancy and unknown tax stop being
disqualifiers and become **a bias term with a measured variance** — which is what they always were.

This is the single change that converts the largest rejection category in v5 into usable input. It is also
the change that most needs guarding: an offset fitted on too few cities is v1's mistake in new clothing.
The guard is §4 gate 8 — an offset may only ship where it is fitted on ≥12 cities and reduces held-out
median APE against the uncalibrated value.

### 3.4 Evidence grades

Every one of the 19 values ships with a grade. The grade is stored, propagated through
`plan-comparison.ts`, and **shown in the UI**.

| Grade | Meaning | Interval | Example |
| --- | --- | --- | --- |
| **A** | Directly observed this refresh, definition-compatible | ±10% | Numbeo cappuccino |
| **B** | Observed, but occupancy/tax unknown; source-calibrated | ±20% | Expedia 3★ trend |
| **C** | Derived from a measured anchor via a validated ratio | ±25% | 4★ from 3★ |
| **D** | No city anchor; regional/band median | ±45% | 1★ in a sparse city |

Grade D is what makes 100% coverage achievable *and* honest, and it is what v5 lacked. A city like Don Det
— 0/5 in every food/drink attempt across Experiments 017, 019, 022 — gets grade D values with a wide
published interval instead of blocking the entire methodology.

`activities_free` is grade **definitional** and excluded from scoring.

---

## 4. Acceptance gates

Product-level, because the product is a **budget planner, not a quote service**. CLAUDE.md states the aim
directly: *"the right order of magnitude and the right ranking, not a quote."* v5's gates were written as
if the second half of that sentence did not exist.

| # | Gate | Threshold | Why this number |
| --- | --- | --- | --- |
| 1 | Field coverage | 19/19 numeric for ≥95% of in-scope cities, every value graded | Grade D guarantees this is reachable |
| 2 | Tier accuracy, held out | median APE ≤35%, p90 ≤75% per tier | v4 measured 18–22% as the realistic ceiling; the ladder achieves 11–13%. 35% is a floor that admits the weak tiers, not a target |
| 3 | **City ranking** | Spearman ρ ≥0.90 on total daily cost; pairwise ordering ≥85% | **This is the product's actual job** — Lisbon vs Copenhagen |
| 4 | Cost-band agreement | ≥80% exact, 100% within one band | v4 measured 63% exact for new cities; this must improve |
| 5 | Trip-level realism | Simulated 10-city trip total within ±20% of ground-truth composition | Errors partially cancel across a trip; this is what the user sees |
| 6 | **No regression vs v1** | v6 beats shipping v1 on ≥15 of 19 tiers, loses on none by >10% | **The gate v5 never had.** v1 is the live alternative |
| 7 | Repeatability | 3 calls × 5 hard cities, per-tier relative range ≤25% for grades A/B | Exp 081 already shows 0% for activities |
| 8 | Calibration integrity | Every shipped offset fitted on ≥12 cities and improving held-out APE vs uncalibrated | Prevents §3.3 becoming a new asserted constant |
| 9 | Refresh economics | ≤6 calls, ≤25 searches, ≤A$0.15/city; full 121-city refresh ≤A$20, ≤24h | The real constraint, honestly stated |
| 10 | Provenance | No grade-C/D value renderable without its grade; blocked ≠ not_found preserved | Inherited from v5, non-negotiable |

**Amendment rule, inherited and strengthened:** a gate may be amended only *before* the holdout is used,
with a dated rationale. Never weaken a gate after seeing its result. v6 adds the converse obligation —
**a gate that cannot be met by any method must be replaced, not endlessly re-attempted.** If three
consecutive experiments fail the same gate for the same structural reason, the gate is the defect.

---

## 5. The ground-truth programme

The one genuinely new collection work, and the thing that retires the sample-size objection permanently.

**40 cities × 17 validation measures, collected once per measure, by any means.** v5 required production-shaped collection for
everything; v6 separates the two concerns explicitly:

- **Production collection** must be target-model feasible. Non-negotiable.
- **Ground truth** may be collected by browser automation, manual research, or a stronger model — because
  it is never in the production path. It exists only to fit offsets and score holdouts.

v5's own rule permitted this ("Manual or browser collection may create ground truth"), but the loop never
spent effort there because §1.6's instruction always redirected it to the next production-shaped panel.

**Design:**

- 40 cities: 25 development, **15 locked holdout**, stratified across 9 regions × 3 cost bands
- Deliberately includes 5 sparse cities (Don Det, Kyoto, Fukuoka class) to characterise grade D honestly
- Per city: dated two-adult one-night quotes for hostel dorm, hostel private, 1★, 2★, 3★, 4★, one
  attraction ticket, five independent restaurant/drink menu measures, the McDonald's combo, and two
  independent activity measures. These 17 rows support all 19 product tiers; street food is the explicit
  production derivation from the independently collected McDonald's anchor.
- Fixed reference window, recorded retrieval dates, source URLs, tax status
- Collected with Chrome automation where a plain fetch fails, which v4 established is the blocker
  ("a plain page fetch cannot obtain a dated quote from a hotel's own site")

Estimated effort: 2–4 days of collection. This is bounded, unlike the 95-experiment search that preceded it.

---

## 5.1 Current M3 owner reset — 10 August 2026

The 25-city x 18-measure development ledger is preserved at **280 found / 0 pending**, but it is item-level
evidence and does not by itself validate the product's daily-spend tiers. The previous holdout is spent: all
18 measures are `revealed_once`. The old all-tier score was `not_evaluable` because it had truth without the
matching production predictions. No new holdout action is permitted before Phase 6 and owner approval.

The active M3 design is:

- Generate exact production-path 19-tier predictions for the 25 development cities. The first run is
  recorded as 0/25 because this checkout has no provider credential; each city is explicit `not_run`.
- Record one labelled BudgetYourTrip page per development city for food and activity budget/mid/luxury
  per-person/day tiers. Food is independent of production Numbeo; activity rows are production-source
  diagnostics and cannot be promoted to independent truth. Use Expatistan cocktail and neighbourhood-pub
  beer for drinks; do not recollect wine glass after the rejected bottle calibration.
- Require fitted relations to have n >= 8. Below that threshold, generated coefficients use a documented
  reasoned constant or regional prior with an honest grade and interval. Street food ships the owner-directed
  0.5 x inexpensive-meal reasoned constant, grade C, +/-35%; the n=3 premium fit is rejected.
- Rebuild region -> region|band -> global priors from direct development evidence and labelled BYT tiers;
  the live 121-city CSV is not read or inverted.
- Score development only and label every evaluable number **IN-SAMPLE**. Circular, partial and unpaired
  measures remain blocked rather than becoming false validation.
- Verify BYT page existence for a proposed 15-city draw from the 81 neither-panel cities, require at least
  72/90 found BYT tier rows before freeze/read, and stop for owner approval.

## 6. Milestones and honest success estimates

| # | Milestone | Output | Effort | P(success) |
| --- | --- | --- | --- | --- |
| **M0** | Adopt v6 — **COMPLETE** | Contracts frozen, ladder fitted, loop replaced, docs bannered, memory repaired | done | — |
| **M1** | **Ship the path** | v6 derivation + grades + ladder behind a flag; new cities generate through v6; 121 CSV untouched | 2–3 d | **90%** |
| **M2** | Ground truth | 40-city × 17-measure panel, with per-measure holdout seals | 5–10 d | 75% |
| **M3** | Fit + validate all 19 tiers | Every derivation generated, development-fit and one-time holdout result per tier; full-basket gates evaluated | 5–10 d | 65% |
| **M4** | Migrate | Regenerate 121 cities with grades, A/B vs v1, rollback tested | 2–3 d | 85% |
| **M5** | Improve weak grades | 1★, dorm/private split, activity semantics | ongoing | 50% |

**Overall probability of a working, honestly-labelled, integrated city-cost system: ~80%.**

Compare with v5's remaining probability of passing its own Definition of Done, given 95 experiments of
evidence about its unreachability: **under 5%.**

M1 is the important one. **After M1 the app has a working generation path**, regardless of what M2–M5
conclude. Everything after M1 improves grades on a system that is already shipping. This is the inversion
of v5's sequencing, and it is the single change most responsible for the difference in success rate.

The largest residual risks sit in M3 (gate 3, ranking, is untested — though ratios preserve ordering by
construction, so it is more likely to pass than the tier gates) and M5 (1★ has resisted 15 experiments;
v6's answer is to stop trying to measure it and ship it graded).

---

## 7. What is reused, and what is retired

**Reused, essentially unchanged — this is why v6 is fast:**

| Asset | Where | Role in v6 |
| --- | --- | --- |
| Derivation function | `src/lib/city-cost-methodology-v5.ts` | The v6 derivation core, unchanged |
| Data dictionary | `data/reference/v5/data-dictionary-v5.md` | Estimands kept; only the *evidence* rule relaxes |
| `evidenceBasis`, FX, `money`/`quantile` | `src/lib/city-cost-methodology-v3.ts` | Grade and interval plumbing |
| Numbeo route | Exp 016–019, 022 + prompts | Spine call A verbatim |
| BudgetYourTrip route | Exp 035/036/080/081 + prompts | Spine call C verbatim |
| Expedia route | Exp 028–088 + prompts | Spine call B verbatim |
| Pooled ladder evidence | 101 rows / 51 cities | v6.0 accommodation coefficients |
| v4 ratio fits | `data/reference/dry-run/phase-0c-ratio-model-fit.json`, `data/reference/dry-run/phase-0h-accommodation-class-ratios.json` | v6.0 food/drink coefficients + cross-validation |
| 176-row observation ledger | `data/reference/observations/` | Calibration and validation input |
| Experiment protocol | PLAN.md §Experiment protocol | Kept for M5; pre-registration is genuinely good practice |
| The five retained traps | PLAN.md §Traps | All five remain true and hard-won |

**Retired:**

| Retired | Reason |
| --- | --- |
| One-call production constraint | §1.5 — optimised a non-binding cost |
| 30-city + 10-holdout per relationship | §1.2/1.3 — unreachable, and superseded by cross-source replication |
| Row-level occupancy/tax admissibility | §1.1 — unsatisfiable from commercial sources |
| Complete-city coverage metric | Masked the fact that two thirds of the anchor space was solved |
| Fail-closed-to-blank at the product | §1.4 — replaced by fail-closed-to-*graded* |
| `LOOP-PROMPT.md` as written | §1.6 — non-terminating by construction |
| Direct page reads in production | Exp 013, 015 — settled; search snippets only |

Nothing is deleted. Every experiment directory, verdict, and raw response stays where it is, per the
project's convention of marking rather than removing superseded decisions.

---

## 8. Open product decisions

These need the user, not an experiment. Each has a recommended default so work is not blocked.

1. **Six accommodation tiers, or five?** `accom_1_star` has no direct evidence after 15 experiments, and
   1-star inventory is genuinely vanishing in many markets. Merging 1★ into 2★, or presenting 1★ as an
   explicit "budget hotel" band, would remove the single worst-supported field.
   *Default if no answer: keep six, ship 1★ at grade C.*

2. **Grade visibility in the UI.** Options: a subtle per-value badge; a per-city confidence summary; or
   intervals shown on the planner totals.
   *Default: per-city summary badge plus per-value tooltip, which reuses the existing info-popover pattern
   from the dashboard's 11 summary cards.*

3. **Refresh cadence.** Ladder coefficients are stable; only levels drift.
   *Default: re-measure levels quarterly, refit coefficients annually.*

4. **Does the 121-city CSV get regenerated, or only new cities?**
   *Default: regenerate at M4 behind a flag, with the current CSV retained for rollback and an A/B diff
   report produced before switching.*

---

## 9. Verification

Unchanged from the project baseline; v6 adds no new commands.

```
npx tsc --noEmit          # expected to pass
npm run build             # expected to pass
npm test -- --run         # 142 tests + new v6 grade/ladder tests
npm run docs:check-memory # AGENTS.md mirrors CLAUDE.md
```

---

## 10. Adoption checklist (M0) — complete 9 August 2026

- [x] `> **SUPERSEDED**` banner on `docs/dev/plans/city-cost-methodology-v5.md`, and on the v4/v5 handoffs
- [x] `LOOP-PROMPT.md` moved to `docs/dev/archive/loop-prompt-v5.md` with a banner recording §1.6
- [x] `LOOP-PROMPT-V6.md` written — ship-first, terminating, with stopping rules
- [x] `PLAN.md` rewritten around §6's milestones, preserving the app backlog and the traps
- [x] `docs/dev/handoffs/city-cost-v6.md` written as the cold-start document
- [x] `data/reference/v6/` frozen: README, data dictionary, validation manifest, coefficients
- [x] `scripts/fit-city-cost-ladder-v6.mjs` added; ladder reproducible via `--check`
- [x] v5 programme closure appended to `LOG.md`
- [x] `CLAUDE.md` city-cost section updated; `npm run docs:sync-memory` / `docs:check-memory` pass
- [x] Branch renamed to `feat/city-cost-methodology-v6`

### 10.4 The replacement loop prompt

If autonomous work resumes, `LOOP-PROMPT.md`'s replacement must differ in four specific ways, or v6 will
reproduce v5's failure:

- **Ship first.** "Integrate behind a flag at M1, before any accuracy work. Do not defer integration to
  acceptance."
- **Bounded, terminating gates.** "If three consecutive experiments fail the same gate for the same
  structural reason, stop and report the gate as the defect. Do not attempt a fourth."
- **Invert the priority rule.** Replace *"do not polish a workable model while another category is
  incomplete"* with *"bank the workable categories first; a category with three consecutive structural
  failures is downgraded to grade C/D and left there."*
- **An experiment budget.** "No more than 8 experiments per product field. Exceeding it is a signal to
  change the estimand or accept a lower grade, not to run a ninth."

---

## Appendix A — reproducing the ladder finding

The §1.3 result comes from pooling every Expedia panel, deduplicating by city and class, comparing only
same-currency pairs, and scoring R0 leave-one-out at city level. It should be reproduced as a checked-in
deterministic script at M3 (`scripts/fit-city-cost-ladder-v6.mjs`, with `--check`) alongside the existing
`scripts/fit-city-cost-ratios.mjs`.

Source experiment directories: `028`, `029`, `059`–`063`, `065`, `075`, `078`, `085`–`088` under
`data/reference/v5/experiments/`.

Observed pooled totals: 101 rows across 51 cities — 1★ **0**, 2★ 23, 3★ 43, 4★ 35. The zero for 1-star
across every panel is itself a finding, and is the evidential basis for §8 decision 1.
