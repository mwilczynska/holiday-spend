# City Cost v6 — Evidence Inventory

**This directory is the v6 contract and evidence root.** If you are an agent picking up this workstream
cold, read `docs/dev/handoffs/city-cost-v6.md` first — it tells you the exact next action. This file
tells you what lives here and what each file is for.

**Status:** the v6.1 new-city implementation is banked and M4 migration of the existing 121-city library
was approved on 12 August 2026. The live CSV is still unchanged. Phase 6 release reconciliation and Phase 7F
collection-lifecycle repair are complete. Experiment 010 is a credential preflight, 011 is failed boundary history,
012 is immutable incomplete-frame evidence, 013 is immutable failed canary history, and 014 is the active immutable
passed canary: 60/60 terminal/reusable slots, 20/20 complete cities and zero artifact candidates. Phase 7H lifecycle/
evaluator repair and the fresh canary baseline are complete; Phase 8 migration tooling is complete and Phase 9
staging is active at 60/121 cities, with batch 005 next. Batch 004 had zero all-prior artifact candidates but
0/10 direct drink categories; that operational coverage finding is retained for the Phase 10 report.
Its result reports 167 searches while `collection-incidents.json` records four additional discarded-attempt searches.
Read
`docs/dev/plans/city-cost-methodology-v6-1.md` and
`validation-manifest-v6-1.json`. Every old holdout is spent and closed; none is reopened for migration.
The preflight record is `experiments/010-v6-1-runtime-canary/`; it is not runtime coverage evidence and must
not be rerun or mutated.

## Active v6.1 simplification

The v6.1 source spine is Expedia 3-star, BudgetYourTrip's three daily food plus three daily activity tiers,
and Numbeo cappuccino plus domestic beer: exactly three calls and at most ten searches per city. It keeps
all 19 fields. Accommodation uses the banked ladder, BYT tiers scale from per person/day to two people/day,
drinks are explicit consumption presets, and street food is an explicitly grade-D compatibility model.
There is one regional/global tier-vector fallback per category.

Implementation reuses experiments 003 and 006 and requires zero new development collection. Food and
activities are BYT source-backed product estimates, not independently validated truth; drinks are
source-priced presets. That source dependence is a completed, disclosed evidence state. The active prompts
are the three `llm_prompt_city_cost_v6_1_*.md` files listed in `docs/prompts/README.md`.

## Active migration status — 13 August 2026

Phase 8 is complete and Phase 9 is active. `migration-v6-1/` contains the frozen 121-city protocol,
checkpoint, per-call raw/telemetry evidence, call-level reuse ledger, normalized/materialized artifacts and
staged CSV/provenance/import-plan outputs. Experiment 014 supplied 60 validated calls for a 20-city dry run;
the remaining 61 cities are to be collected in fixed batches through the same three-call contract. The staged
artifact is not the live CSV, and no database import or cutover has occurred. Phase 9 batches 001-004 add
40 delegated cities (60/121 staged in total). Batches 001 and 002 each record one all-prior candidate at 10%;
batch 003 records two (Santa Fe (Bantayan) and Siargao, 20%); batch 004 records none. All are below the 30% stop
rule. Batch 004 had 0/10 direct drink categories, which is retained for Phase 10 review. Batch 005 is next, with
61 cities remaining.

## Historical v6.0 M3 evidence

The earlier item-level all-tier holdout route is superseded. `experiments/007-production-prediction-bundle-initial/` preserves the
first exact provider-path run: 0/25 materialized because no local provider credential was configured, with
explicit `not_run` rows. The current paired route is `experiments/006-development-prediction-spine/`: it
contains 75 delegated schema-validated responses and 75 telemetry records, including 15 byte-identical
Expedia reuses from experiment 001, and Stage-B bundles generated through `materializeCityCostV6` for 25/25
cities without reading a holdout.

`experiments/003-budgetyourtrip-tier-panel/` contains one labelled BYT tier record per development city;
24/25 cities have six rows and Colombo is explicit `not_found`. Food rows are independent of Numbeo; activity
rows are production-source diagnostics and are not independent validation. `experiments/004-expatistan-drink-panel/`
retains four accepted cocktail rows and three accepted neighbourhood-pub beer rows; remaining cities are explicit missingness and wine glass is intentionally not collected.
`experiments/005-development-in-sample-score/` is the normalized in-sample scorer protocol. Its current
result has 9 evaluable tiers, one definitional tier, 8 explicitly blocked tiers and one not-evaluable
activity tier; it is not holdout validation.
`m3-development-in-sample-report.md` is the generated 19-tier table and gate 2–6 status for that score.

`priors-v6.json` is the historical v6.0 generated prior. v6.1 uses the separate generated
`priors-v6-1.json`, built by `scripts/build-city-cost-v6-1-priors.mjs` from normalized development source
fixtures and never from the shipping CSV. The v6 runtime no longer reads or inverts
`data/reference/city_costs_app_aud.csv` to construct priors. The retained proposal
`ground-truth/fresh-holdout-proposal-v2.json` records verified BYT page existence and a 72/90 minimum
coverage gate, but it contains no values and is cancelled for v6.1.

## v6.0 paired prediction result — 10 August 2026

Experiment 006 supplied 75 delegated raw responses and 75 telemetry records for the 25-city development
panel. Fifteen Expedia responses were reused byte-for-byte from experiment 001; all other files were
validated against `city-cost-v6-spine-response-v1`, with zero direct page reads and explicit missingness.
The Stage-B generator ran the shared `materializeCityCostV6` implementation and produced 25/25 full
19-tier bundles.

The corrected in-sample development score has 9 evaluable tiers (six accommodation and three food), one
definitional tier, 8 blocked tiers and one not-evaluable activity tier. Food scores require observed Numbeo
source anchors and exclude 11 cities for budget and 12 for mid/high; exact lists are in the score artifact
and generated report. The 25 official attraction rows are preserved ticket observations but are not truth for
the daily-spend activity estimand, so all three activity tiers are not independently evaluable. Gates 3–6 are
therefore `not_evaluable` on this partial panel; no number here is a holdout result.

The measured street-food R0 `k=0.3248`, n=6, with a ±336% LOO-p90 interval is diagnostic only under the
uniform minimum fitted n=8 rule. Production uses the generated global direct-evidence prior ratio `k=0.2757`
at grade D ±45%. The prior builder historically listed 34 frozen-FX exclusions; the 12 August SGD/TWD/ZAR/PEN
snapshot repair reduced current v6.1 prior exclusions to zero.

`m3-food-basket-diagnostic.json` is an existing-data, in-sample diagnostic. It records the budget
beverage category-boundary effect, the mid/high effective basket-weight re-fits with LOO residual
dispersion, and Numbeo observation rates by region. It does not change shipped coefficients, read a
holdout, or provide independent drinks truth.

---

## Files in this directory

| File | What it is | When you touch it |
| --- | --- | --- |
| `README.md` | This file — the inventory | When you add an artifact here |
| `data-dictionary-v6.md` | Product estimands, evidence grades and dated methodology decisions | Read before deciding what a value means or what grade it carries |
| `validation-manifest-v6-1.json` | **Active v6.1 source contract and reachable release gates** | Implement and score this manifest for v6.1 |
| `validation-manifest-v6.json` | Historical v6.0 acceptance gates and spent 40-city panel | Preserve unchanged; do not use it to block v6.1 |
| `coefficients-v6.json` | **Generated.** Banked accommodation ladder plus retained v6.0 relationship evidence; v6.1 compatibility entries are also generated here | Never hand-edit. Regenerate with the script below |
| `priors-v6-1.json` | **Generated.** v6.1 direct-source category priors and explicit FX exclusions | Regenerate with `scripts/build-city-cost-v6-1-priors.mjs --check` |
| `v6-1-development-release-report.md` | Generated 25-city × 19-tier release report; no holdout claims | Regenerate through the release validator |
| `v6-1-release-validation.json` | Generated reachable-gate result and replay metrics | Verify with `scripts/validate-city-cost-v6-1-release.mjs --check` |
| `v6-1-rollout-preview.json` / `.md` | Generated read-only v1-versus-v6.1 operational impact preview | Verify with `scripts/generate-city-cost-v6-1-rollout-preview.mjs --check`; owner review only |
| `experiments/010-v6-1-runtime-canary/` | Immutable credential-preflight history; zero provider calls, not a 0/20 source-coverage result | Do not mutate or rerun |
| `experiments/011-v6-1-delegated-operational-canary/` | Immutable delegated boundary finding; 17/20 complete, failed before the corrected identity/missingness/beer contract | Preserve as regression evidence; do not restate as passed |
| `experiments/012-v6-1-corrected-delegated-canary/` | Immutable incomplete-frame history; original report says 10/20, independent inventory finds 32 reusable pairs and 28 pending slots | Preserve unchanged; do not promote to a clean canary or finalize a new experiment with pending slots |
| `experiments/013-v6-1-resumable-delegated-canary/` | Immutable full-frame failed canary; 19/20 complete, two invalid Prague calls after duplicate assignment, 20/20 deterministic/provenance replay | Preserve unchanged; Phase 7H is complete, and the fresh canary must pass before Phase 8 |
| `experiments/014-v6-1-final-delegated-canary/` | Immutable passed canary; 60/60 terminal/reusable calls, 20/20 complete cities, 167 searches, zero retries/direct reads, zero artifact candidates and 20/20 provenance round-trips | Active canary evidence; use as the Phase 8 dry-run fixture; never mutate |
| `ground-truth/` | Frozen-window development ledger, raw holdout ledger, one-time score report and lock marker | Validate the development ledger; the raw holdout was scored once and must not be reopened or rescored |
| `experiments/` | v6 experiment directories, one per material candidate (created from M2 onward) | One directory per experiment, same protocol as v5 |

---

## Regenerating the coefficients

```bash
node scripts/fit-city-cost-ladder-v6.mjs           # fit and write coefficients-v6.json
node scripts/fit-city-cost-ladder-v6.mjs --check   # verify on disk matches the evidence; exit 1 on drift
```

The script reads only files already in the repo. It makes no network or model calls, so it is free and
instantaneous. `--check` belongs in any verification run.

Current output:

```
pooled 101 hotel rows across 51 cities
accom_2_star <- accom_3_star           n=18  k=0.7500  LOO medAPE 11.37%  p90 24.63%
accom_4_star <- accom_3_star           n=26  k=1.3372  LOO medAPE 12.98%  p90 27.18%
hostel_dorm_bed_1p <- accom_3_star     n=25  k=0.2955  LOO medAPE 20.92% p90 53.16%  (Booking v2 development)
hostel_private_room_2p <- accom_3_star n=25  diagnostic k=0.7955; shipped k=0.5919 v4 rollback (±35%)
hotel_2star_room_2p <- hotel_3star_room_2p  n=25  diagnostic k=0.8182  LOO medAPE 17.85% p90 37.71%
midrange <- inexpensive                  n=12  k=5.2256  LOO medAPE 20.64% p90 38.41%
street food <- inexpensive               n=6   diagnostic k=0.3248; shipped fallback k=0.2757 (grade D ±45%)
premium <- midrange                      n=5   reasoned k=1.5000 (minimum fitted n=8; grade D ±45%)
cocktail <- cappuccino                    n=14  k=2.4838  LOO medAPE 18.86% p90 63.24%
wine glass <- cappuccino                  n=7   diagnostic only; excluded from drinks_heavy after rejected bottle calibration
mcmeal/inexpensive                       n=0   not fitted; McMeal remains a measured production anchor
half-day activity                         n=0   no independent compliant row; direct production anchor
full-day activity                         n=1   below fit threshold; direct production anchor
cross-check 2-star: v6 0.7500 vs v4 0.7341 -> 2.17% apart
cross-check 4-star: v6 1.3372 vs v4 1.2972 -> 3.08% apart
```

The initial generator snapshot above predates the paired-prediction reset. Its n=6 street-food relation is
retained as a diagnostic; the current generator does not ship it because it is below the minimum n=8 rule and
uses the global prior ratio k=0.2757 at grade D, ±45%. The n=5 premium relation ships the documented v4 1.5x fallback at grade D, ±45%, rather than its
small-sample fit. Cocktail remains fitted at n=14 (`k=2.4838`, ±64%). Wine glass remains a raw menu diagnostic only
and is excluded from the heavy-drinks basket after the rejected Expatistan bottle-to-glass calibration.
McMeal, half-day and full-day routes remain diagnostics or direct-source fallbacks, never asserted fitted
coefficients.

---

## The v6.1 shape in one paragraph

Use three bounded search-snippet calls: Expedia for one accommodation level, BudgetYourTrip for three food
and three activity daily-spend tiers, and Numbeo for cappuccino and domestic beer. Deterministic code emits
all 19 planner fields, preserving the accommodation ladder and modelling the remaining product presets.
Grade every value A through D, attach an interval, and use one category-level regional/global fallback.
Never present a source proxy, model or fallback as observed truth.

The operative rule is now: *measure what is systematic, model the remaining presets explicitly, and disclose
the difference.* A documented grade-D compatibility assumption is a valid completion state.

For the v6.1 Numbeo drinks call, the domestic draft-beer anchor accepts the exact canonical row displayed
by Numbeo as either `Domestic Draft Beer (0.5 Liter)` or `Domestic Draft Beer (1 Pint)`. The displayed unit
is preserved and deterministic code counts one displayed serving without conversion; bottled or imported
beer is not accepted. Experiment 011's resulting 0/20 beer observations is retained as failed contract
evidence, not as a reason to replace Numbeo with a prior.

---

## Where the evidence came from

**All of it already existed.** v6 introduces no new collection before M2. The v5 programme ran 95
experiments and accepted zero product mappings, but it produced a large and genuinely useful asset base:

| Route | v5 experiments | What it gives v6 | Coverage measured |
| --- | --- | --- | --- |
| Numbeo search snippets | 016–019, 022 | Cappuccino and domestic beer for the v6.1 drink call; older food fields retained as v6.0 evidence | 144/150 historical five-field cells; v6.1 needs only two |
| Expedia class trends | 028, 029, 059–063, 075, 078, 085–088 | `hotel_3star_room_2p` anchor **and** the fitted ladder | 101 rows, 51 cities, 43 with a 3-star anchor |
| BudgetYourTrip daily tiers | 003 plus v5 035, 036, 080, 081 | Three food and three activity daily tiers, v6.1 spine call B | 24/25 development city pages with all six tiers |
| Expatistan | 091, 092 | cocktail + wine bottle, optional spine call D | 10/12 and 12/12; cocktail cross-checked vs independent menus (ratio 0.917) |
| Price of Travel Hostel Index | 072 | dorm-bed ratio | 12/12 strict rows; **2023 window, stale** |
| v4 ratio fits | `data/reference/dry-run/phase-0c-ratio-model-fit.json`, `data/reference/dry-run/phase-0h-accommodation-class-ratios.json` | food/drink coefficients + independent ladder cross-validation | n=97/68 food-drink; n=16/13 accommodation |

The v5 experiment directories under `data/reference/v5/experiments/` are **retained in full and are not
superseded as evidence** — only the acceptance rule that governed them is. Their verdicts remain accurate
statements about what each source could and could not supply.

---

## The one thing to understand before changing anything

v5 rejected the accommodation ladder **eleven times** for having fewer than 30 matched cities. Pooling
its own evidence and scoring leave-one-out at city level shows the ladder achieves **11.4% and 12.98%
median error** — roughly half what the gate allowed — and **replicates v4's independent Booking.com fit
to within 2.17% and 3.08%** from a different source, estimator, year and city sample.

The sample-size gate was a *proxy* for "does this relationship generalise?". Cross-source replication
answers that question better than a larger single-source sample would. v6 exists because that answer was
already in the repo.

Full diagnosis: `docs/dev/plans/city-cost-methodology-v6.md` §1.

---

## Relationship to `data/reference/v5/`

| | v5 | v6 |
| --- | --- | --- |
| Product estimands | frozen in `v5/data-dictionary-v5.md` | 19 user-facing fields retained; internal v6.1 source semantics amended by dated decision |
| Evidence admissibility | binary: metadata stated or rejected | **graded A/B/C/D** |
| Acceptance gates | per-relationship sample size | v6.1 release integrity, economics, provenance and banked accommodation accuracy |
| Experiment evidence | 95 directories | **all retained and still valid as evidence** |
| Derivation code | `src/lib/city-cost-methodology-v5.ts` | **same file, reused unchanged** |

Nothing under `data/reference/v5/` is deleted or moved. Per project convention, superseded decisions are
marked and dated rather than removed, so the reasoning that replaced them stays legible.

## M2 ground-truth ledger

`ground-truth/development-ledger.json` is the manifest-driven 25-city x 18-measure collection ledger. It
starts with no fabricated values; each found observation must retain its displayed currency, source URL,
retrieval timestamp, tax/fee wording, and property name for accommodation. Run
`node scripts/validate-city-cost-v6-ground-truth.mjs` to check the development ledger. The collected
`ground-truth/holdout-ledger.json` is the spent six-measure holdout. The twelve new measures are in the
per-measure `ground-truth/holdout-extension.json` seal lifecycle; batch 007 resolved all 180 fresh slots
with 12 found independent menu rows and 168 explicit `not_found` rows, then sealed them without printing
their prices. The validator checks seal metadata but does not read holdout observations. Those holdouts are
spent and remain closed; v6.1 neither freezes nor scores another holdout. Experiment
`experiments/001-expedia-production-anchor/` separately replayed the Expedia production extractor on the
15 matched development cities and accepted the existing offset (median APE 8.36%, median signed error
7.08%); it did not refit the offset or read the holdout.

---

## Runtime and migration boundary

The opt-in runtime flag `CITY_COST_METHODOLOGY_V6=true` sends new-city generation through the v6.1
three-call collector and `materializeCityCostV61`. The path makes bounded Expedia, BudgetYourTrip and
Numbeo search-snippet calls, converts source-currency facts with the frozen FX snapshot, and uses explicit
regional/global category priors at grade D when a source category is unavailable. Grades, intervals,
missingness and per-call telemetry are stored in `city_estimates.metadata_json` and exposed by
`/api/estimates` and `/dataset`.

The v1 generation path and `data/reference/city_costs_app_aud.csv` are still unchanged today. The owner has
approved replacing that CSV through the staged M4 protocol in the active plan, but not before a live
provider canary and complete owner-reviewed 121-city preview. No food/drink/activity holdout is open work;
source dependence is disclosed instead.

> **Do not move or rename anything under `data/reference/`** without updating its readers. Scripts and
> six Vitest test files reference those paths as string literals.
