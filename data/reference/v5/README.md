# City Cost v5 Evidence Inventory

This directory contains current v5 methodology contracts, experiment artifacts, and validation outputs.
It is separate from the live v1 CSV and the retained v3/v4 evidence. Existing files under
`data/reference/` are not moved or renamed.

## Contracts

| Path | Status | Purpose |
| --- | --- | --- |
| `data-dictionary-v5.md` | **CURRENT** | Frozen estimands, units, bases, and missingness semantics for v5 experiments |
| `validation-manifest-v5.json` | **CURRENT** | City-level development/validation/holdout contract and acceptance gates |

## Experiments

| Path | Status | Purpose |
| --- | --- | --- |
| `experiments/000-baseline-reassessment/` | **COMPLETE — candidate baseline rejected** | Reproducible audit of what v3/v4 evidence can and cannot support |
| `experiments/001-one-call-harness/` | **CURRENT — API telemetry optional** | One-call extractor contract, fixture, and provider telemetry harness |
| `experiments/002-accommodation-ladder/` | **COMPLETE — candidate rejected** | Accommodation ratio and hostel-unit identifiability audit |
| `experiments/003-derivation-contract/` | **COMPLETE — contract retained** | Pure 19-tier derivation and provenance propagation contract |
| `experiments/005-target-model-subagent/` | **COMPLETE — revise and retest** | GPT-5.6 Luna-class prompt-feasibility outputs for difficult cities |
| `experiments/006-source-cascade-retest/` | **COMPLETE — revise and retest** | Explicit source-cascade retest on the same five difficult cities |
| `experiments/007-minimal-anchor-retest/` | **COMPLETE — promote to model-boundary validation** | Nine-anchor prompt feasibility and coverage comparison |
| `experiments/008-omitted-anchor-ground-truth/` | **COMPLETE — broad collection rejected** | Omitted-anchor ground-truth feasibility and basis audit |
| `experiments/009-accommodation-panel-feasibility/` | **COMPLETE — broad accommodation panel rejected** | Narrow six-class accommodation collection feasibility and basis audit |
| `experiments/010-date-fixed-accommodation-contract/` | **COMPLETE — search-index contract rejected** | Date-fixed source-family accommodation feasibility |
| `experiments/011-direct-class-page-templates/` | **COMPLETE — partial promotion** | Direct class-page URL template feasibility; Booking 3/4-star averages promoted for broader audit |
| `experiments/012-single-city-production-shape/` | **COMPLETE — shape promoted, source rejected** | Three independent one-city Copenhagen calls, repeatability, and 4-star basis comparison |
| `experiments/013-interactive-official-quote-extraction/` | **COMPLETE — target web route rejected** | Three one-city Copenhagen calls against known official booking engines |
| `experiments/014-single-city-numbeo-food-drink/` | **COMPLETE — revise URL normalization** | Three one-city Numbeo calls; Lisbon succeeded via canonical case-correct URL |
| `experiments/015-numbeo-canonical-url-retest/` | **COMPLETE — direct page route rejected** | Canonical Copenhagen/Prague Numbeo calls returned 503/429 |
| `experiments/016-numbeo-search-snippet-fallback/` | **COMPLETE — promote to broader validation** | Two one-city search-only calls returned 10/10 food/drink anchors |
| `experiments/017-numbeo-search-broad-panel/` | **COMPLETE — promote with sparse-city failure** | Six independent one-city calls returned 25/30 exact food/drink anchors; Don Det 0/5 |
| `experiments/018-numbeo-search-30-city/` | **COMPLETE — promote food/drink route; reject complete pipeline** | 30 independent one-city calls: 144/150 cells, 28/30 complete; locked holdout 44/50 |
| `experiments/019-numbeo-repeatability-edge-cases/` | **COMPLETE — mixed; dedicated-query provenance required** | 15 repeats: Kyoto/Don Det stable no-result, Nha Trang/Beijing stable values, Helsinki query-sensitive |
| `experiments/020-activities-search-feasibility/` | **COMPLETE — promote attraction pattern only** | Six one-city calls: strict activity coverage 6/18; Hanoi only complete |
| `experiments/021-accommodation-class-search-feasibility/` | **COMPLETE — reject complete route** | Six one-city calls: 7/36 class cells, no complete city; retain source candidates |
| `experiments/022-numbeo-identity-cascade/` | **COMPLETE — promote bounded route** | Six one-city calls: 21/30 cells, four complete; Don Det 0/5 |
| `experiments/023-activity-ground-truth-audit/` | **COMPLETE — reject activity model fit** | Accepted-direct ledger has 29 paid-attraction cities, 3 half-day, 2 full-day, and one complete city |
| `experiments/024-accommodation-ground-truth-panel/` | **COMPLETE — reject strict route; revise boundary** | Three one-city calls: 3/18 strict cells, no complete city; test per-bed dorm scaling next |
| `experiments/025-accommodation-bed-boundary/` | **COMPLETE — promote boundary; route incomplete** | Three paired one-city calls: 6/18 cells, one explicit dorm-bed input, no complete city |
| `experiments/026-accommodation-broader-panel/` | **COMPLETE — retain dorm boundary; pivot hotel coverage** | Three new one-city calls: 5/18 cells, dorm in all three, no complete city |
| `experiments/027-hotevi-tier-feasibility/` | **COMPLETE — reject production source; calibration candidate** | Three one-city calls: 3/9 grouped rows, one dated city, occupancy unknown |
| `experiments/028-expedia-class-trends/` | **COMPLETE — promote 2–4-star candidate; route incomplete** | Three one-city calls: 7/12 trend rows, no 1-star, one duplicate-search deviation |
| `experiments/027-hotevi-tier-feasibility/` | **COMPLETE — reject production source; calibration candidate** | Three one-city calls: 3/9 grouped rows, one dated city, occupancy unknown |
| `experiments/024-accommodation-ground-truth-panel/` | **COMPLETE — reject strict route; revise boundary** | Three one-city calls: 3/18 strict cells, no complete city; test per-bed dorm scaling next |

The API key is optional for prompt feasibility: the delegated GPT-5.6 Luna-class sub-agent can run the
candidate contract without a provider credential. Provider API telemetry remains separately pending.

Raw model responses, source captures, and generated reports must retain retrieval dates, schema/version
metadata, source URLs, currencies, and evidence basis. Do not store copied page content when a URL and
structured extracted facts are sufficient.
