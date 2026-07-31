# Reference Data Inventory

Every committed dataset, what it is, and **whether it is still live**.

> **Do not move or rename anything here without updating its readers.** Scripts and six Vitest test files
> reference these paths as string literals. The "Read by" column is the dependency list.

Legend — **LIVE** feeds the app or the v4 methodology · **HISTORICAL** is retained evidence from the
abandoned v3 programme, still referenced by tests or kept for provenance.

---

## LIVE — the app

| Path | Status | What it is | Read by |
| --- | --- | --- | --- |
| `city_costs_app_aud.csv` | **LIVE** | **The production dataset.** 121 cities, 58 countries, AUD for 2 people, tagged `base_csv_apr_2026`. Every city cost a user sees comes from here | `src/db/seed.ts`, `scripts/fit-city-cost-ratios.mjs`, `scripts/select-city-cost-pilot.mjs` |

> This CSV was produced by the **v1** methodology, whose `4★/3★ = 1.800` and
> `food_high_end/food_mid_range = 1.500` columns are asserted constants carrying no city-specific
> information. It is the live data regardless — the v4 replacement is not built. See `/PLAN.md`.

## LIVE — v4 methodology evidence

| Path | Status | What it is | Read by |
| --- | --- | --- | --- |
| `dry-run/phase-0c-ratio-model-fit.json` | **LIVE** | **Fitted models and validation results.** Regenerates byte-identically | output of `:fit-ratios` |
| `dry-run/phase-0d-numbeo-expanded-sample.json` | **LIVE** | 22-city anchor expansion | `fit-city-cost-ratios.mjs` |
| `dry-run/phase-0e-stage1-numbeo-sample.json` | **LIVE** | Stage 1: 27 cities + 4 rejections, 5 no-source | `fit-city-cost-ratios.mjs` |
| `dry-run/phase-0e-stage1-selection.json` | **LIVE** | The deterministic band-stratified draw rule | provenance |
| `dry-run/phase-0f-stage2-numbeo-sample.json` | **LIVE** | Stage 2 census — **closes the 99-city frame** | `fit-city-cost-ratios.mjs` |
| `dry-run/phase-0a-numbeo-anchors.json` | **LIVE** | 5-city reconnaissance with quality metadata | provenance |
| `dry-run/phase-0b-accommodation-search.json` | **LIVE** | Accommodation reconnaissance, all tiers | provenance |
| `dry-run/phase-0g-stage1-analysis.json` | **LIVE** | First-page estimator depth/ratio/headline analysis | output of `:analyze-accommodation` |
| `dry-run/phase-0h-accommodation-class-ratios.json` | **LIVE** | **The fitted star ladder** — 1.297 / 0.734 / 0.592, and the 1.800 refutation | output of `:fit-accommodation-ladder` |
| `dry-run/stage1/copenhagen-booking-4star.json` | **LIVE** | **108 four-star prices in page order** — the only full-inventory read in existence. Every first-page bias figure rests on this one file | `analyze-accommodation-stage1.mjs` |
| `dry-run/stage1/copenhagen-booking-3star.json` | **LIVE** | 25 prices plus a repeat read, showing inter-read volatility | `analyze-accommodation-stage1.mjs` |
| `dry-run/stage1/stage-b-class-pages.json` | **LIVE** | Class-page captures across 12 cities — the ladder-fitting input | `fit-accommodation-class-ratios.mjs` |
| `dry-run/stage1/wave2-firstpage.json` | **LIVE** | Second wave of first-page captures | `fit-accommodation-class-ratios.mjs` |
| `dry-run/stage1/bangkok-firstpage.json` | **LIVE** | Kept for the **class-inversion anomaly** — 4-star headline below 3-star | provenance |
| `dry-run/stage1/lisbon-firstpage.json` | **LIVE** | First-page capture | provenance |

## CURRENT — v5 methodology evidence

V5 contracts and experiments are kept under `data/reference/v5/`. The workstream is not yet integrated
into the app and does not replace the live v1 CSV.

| Path | Status | What it is | Read by |
| --- | --- | --- | --- |
| `v5/data-dictionary-v5.md` | **CURRENT** | Frozen v5 estimands, units, source bases, and missingness semantics | v5 experiments |
| `v5/validation-manifest-v5.json` | **CURRENT** | City-level validation split and acceptance gates | v5 experiments |
| `v5/experiments/000-baseline-reassessment/` | **IN PROGRESS** | Deterministic audit of retained v3/v4 evidence | `methodology:v5:baseline` |
| `v5/experiments/001-one-call-harness/` | **IN PROGRESS** | Target-model extractor prompt, schema fixture, and one-call telemetry outputs | `run-city-cost-v5-one-call.mjs` |
| `v5/experiments/002-accommodation-ladder/` | **COMPLETE — candidate rejected** | Independent audit of the retained accommodation ladder and hostel identifiability | `methodology:v5:accommodation` |

## LIVE — v3 evidence that v4 runs on

Collected under the abandoned programme, but **still active input**. Do not treat as stale.

| Path | Status | What it is | Read by |
| --- | --- | --- | --- |
| `city_cost_collection_batches.json` | **LIVE** | Extraction-batch manifest. Names the observation files, so it is the entry point to all 176 observations | `fit-city-cost-ratios.mjs`, `build-city-cost-pilot-enrichment.ts` |
| `observations/*.jsonl` | **LIVE** | **176 accepted observations** across 32 cities | via the manifest above |
| `observations/accommodation-copenhagen-shoulder-2026-07-24.jsonl` | **LIVE — critical** | **The only accommodation ground truth that exists.** 5 direct 4-star quotes, median DKK 1,417.43 at a fixed 90-day lead. Every accommodation bias and ladder-validation claim traces here | `score-accommodation-bias.mjs` |
| `fx/city_cost_fx_aud_2026-07-22.json` | **LIVE** | Frozen FX snapshot, 23 currencies, source-attributed per rate | 3 v4 scripts, `materialize-city-cost-v3.ts`, `city-cost-methodology-v3.test.ts` |

## HISTORICAL — v3 programme output

The programme was abandoned. These are kept as provenance and because tests read several of them.
**None of it feeds the app or v4.**

| Path | Size | What it is | Read by |
| --- | --- | --- | --- |
| `accommodation_property_panels_2026_2027.json` | 1.9 MB | Five frozen price-blind property frames (Barcelona, Copenhagen, Da Nang, Lisbon, Prague). The **largest artifact in the repo**. Superseded by the Booking.com channel, but it is the provenance model v4 quote records still follow | 5 panel builders, 1 validator, `accommodation-property-panel.test.ts` |
| `accommodation_reference_windows_2026_2027.json` | 37 KB | 27 pre-registered 90-day low/shoulder/high windows across 9 cities | validator, `accommodation-reference-window.test.ts` |
| `accommodation_quote_attempts/` | — | Append-only ledger keeping quotes, no-availability, and technical failures separate. Records the ~50% yield behind the Copenhagen ground truth | validator |
| `accommodation_website_verifications/` | — | Barcelona 4-star website outcomes per rank | `apply-accommodation-website-verifications.ts`, `accommodation-website-verification.test.ts` |
| `hanoi_accommodation_classification_reconciliation_2026.json` | 98 KB | 330 records pending status reconciliation. **Never unblocked** — zero geolocation-eligible rows | builder + validator |
| `city_cost_collection_pilot.json` | 8.7 KB | The deterministic 36-city pilot selection | `build-city-cost-pilot-enrichment.ts` |
| `city_cost_pilot_enrichment.json` | 98 KB | Population + tourism-intensity predictors, schema v4 with strict/relaxed grading | profile builder, `city-cost-pilot-enrichment.test.ts` |
| `city_cost_pilot_enrichment_inputs.json` | 52 KB | Hand-curated enrichment inputs | enrichment builder |
| `materialized/city_costs_v3_alpha.json` | 652 KB | v3 materialized output — 166/665 cells, fail-closed | `materialize-city-cost-v3.ts`, profile builder |
| `materialized/city_cost_pilot_profile.json` | 9.9 KB | Coverage/missingness profile: 151/684 cells, **zero complete cities**. The artifact that ended the programme | `build-city-cost-pilot-profile.ts` |

## HISTORICAL — the v1 audit

| Path | Status | What it is |
| --- | --- | --- |
| `accuracy_audit.csv` | **HISTORICAL** | **9 observations across 3 cities.** Reported 17.5% MAPE / −16.3% bias and triggered the entire rebuild. Re-examined, its bias is largely one Lisbon cappuccino. Kept because the over-reading of this file is itself a lesson — see `/LOG.md` Part 1 |

## Not in version control

`travel.db`, `travel.db-wal`, `travel.db-shm` — the local SQLite database, gitignored. Rebuild with
`npm run db:seed`.
