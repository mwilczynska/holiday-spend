# City Cost v6 — Evidence Inventory

**This directory is the v6 contract and evidence root.** If you are an agent picking up this workstream
cold, read `docs/dev/handoffs/city-cost-v6.md` first — it tells you the exact next action. This file
tells you what lives here and what each file is for.

**Status:** v6 adopted 9 August 2026. M0, M1 and the original accommodation-scoped M2 collection are complete.
M3 was reopened by owner decision on 10 August 2026: it now requires fitting and holdout-validating all 19
product tiers. The manifest is v2, the panel is 17 measures per city, and M4 migration is out of scope.

---

## Files in this directory

| File | What it is | When you touch it |
| --- | --- | --- |
| `README.md` | This file — the inventory | When you add an artifact here |
| `data-dictionary-v6.md` | **Frozen estimands + the evidence-grade ladder.** Defines what each of the 19 values means and what grade A/B/C/D mean | Read before deciding whether a value is usable or what grade it carries. Amend only by dated decision |
| `validation-manifest-v6.json` | **Frozen acceptance gates + the 40-city ground-truth panel with its locked 15-city holdout** | Read before scoring anything. Never change a gate after seeing its result |
| `coefficients-v6.json` | **Generated.** The fitted accommodation ladder with provenance, leave-one-out scores and caveats for every number | Never hand-edit. Regenerate with the script below |
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
cross-check 2-star: v6 0.7500 vs v4 0.7341 -> 2.17% apart
cross-check 4-star: v6 1.3372 vs v4 1.2972 -> 3.08% apart
```

---

## The v6 shape in one paragraph

Measure **one level per category** with cheap search-snippet extraction — food and drink from Numbeo,
one accommodation level (`hotel_3star_room_2p`) from Expedia, activity tiers from BudgetYourTrip. Derive
everything else in deterministic code from fitted ratios. Grade every value A (observed) through D
(regional prior), attach an interval, and ship it. Never present a modelled value as observed.

This is v4's governing principle — *measure what is cheap to measure, model only the gaps, never assert a
constant* — finally executed rather than blocked.

---

## Where the evidence came from

**All of it already existed.** v6 introduces no new collection before M2. The v5 programme ran 95
experiments and accepted zero product mappings, but it produced a large and genuinely useful asset base:

| Route | v5 experiments | What it gives v6 | Coverage measured |
| --- | --- | --- | --- |
| Numbeo search snippets | 016–019, 022 | 5 food/drink anchors, spine call A | 144/150 cells (96%), 28/30 complete cities; matched rows median APE 0%, p90 7.14% |
| Expedia class trends | 028, 029, 059–063, 075, 078, 085–088 | `hotel_3star_room_2p` anchor **and** the fitted ladder | 101 rows, 51 cities, 43 with a 3-star anchor |
| BudgetYourTrip entertainment | 035, 036, 080, 081 | 3 activity tiers, spine call C | 28/30 complete cities; **0% dispersion** across 3 repeat calls |
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
| Product estimands | frozen in `v5/data-dictionary-v5.md` | **unchanged**, restated in `v6/data-dictionary-v6.md` |
| Evidence admissibility | binary: metadata stated or rejected | **graded A/B/C/D** |
| Acceptance gates | per-relationship sample size | **product-level**: ranking, trip total, beat-v1 |
| Experiment evidence | 95 directories | **all retained and still valid as evidence** |
| Derivation code | `src/lib/city-cost-methodology-v5.ts` | **same file, reused unchanged** |

Nothing under `data/reference/v5/` is deleted or moved. Per project convention, superseded decisions are
marked and dated rather than removed, so the reasoning that replaced them stays legible.

## M2 ground-truth ledger

`ground-truth/development-ledger.json` is the manifest-driven 25-city x 17-measure collection ledger. It
starts with no fabricated values; each found observation must retain its displayed currency, source URL,
retrieval timestamp, tax/fee wording, and property name for accommodation. Run
`node scripts/validate-city-cost-v6-ground-truth.mjs` to check the development ledger. The collected
`ground-truth/holdout-ledger.json` is the spent six-measure holdout. The eleven new measures are in the
per-measure `ground-truth/holdout-extension.json` seal lifecycle; the validator checks seal metadata but
does not read holdout observations. The all-19 M3 candidate coefficients and source offset will be generated
in `coefficients-v6.json`, frozen once before any new measure is read, and scored once. Experiment
`experiments/001-expedia-production-anchor/` separately replayed the Expedia production extractor on the
15 matched development cities and accepted the existing offset (median APE 8.36%, median signed error
7.08%); it did not refit the offset or read the holdout.

---

## M1 implementation

The opt-in runtime flag `CITY_COST_METHODOLOGY_V6=true` sends new-city generation through
`src/lib/city-cost-v6-collection.ts` and `src/lib/city-cost-methodology-v6.ts`. The path makes three bounded
search-snippet extractor calls (Numbeo, Expedia three-star, BudgetYourTrip), retries a reported block once,
converts source-currency facts with the frozen FX snapshot, and falls back to regional/accommodation-band
medians at grade D when an anchor is unavailable. Grades, intervals, missingness and per-call telemetry are
stored in `city_estimates.metadata_json` and exposed by `/api/estimates` and `/dataset`.

The feature flag is deliberately off by default during M1. The v1 generation path and
`data/reference/city_costs_app_aud.csv` remain unchanged. Accommodation-only M2/M3 records are retained,
but the all-19 M3 fit, independent food/drink/activity validation, per-measure holdout read and full score
remain open.

> **Do not move or rename anything under `data/reference/`** without updating its readers. Scripts and
> six Vitest test files reference those paths as string literals.
