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
| `experiments/029-expedia-class-panel/` | **COMPLETE — promote route; 1-star blocker remains** | Three new one-city calls: 8/12 2–4-star rows, no 1-star, no complete city |
| `experiments/027-hotevi-tier-feasibility/` | **COMPLETE — reject production source; calibration candidate** | Three one-city calls: 3/9 grouped rows, one dated city, occupancy unknown |
| `experiments/024-accommodation-ground-truth-panel/` | **COMPLETE — reject strict route; revise boundary** | Three one-city calls: 3/18 strict cells, no complete city; test per-bed dorm scaling next |

| `experiments/030-one-star-source-cascade/` | **COMPLETE — retain calibration candidates; occupancy unresolved** | Three one-city calls: 3/6 Momondo/KAYAK candidates, zero explicit two-adult rows |

| `experiments/031-one-star-occupancy-calibration/` | **COMPLETE — reject explicit-occupancy route** | Three one-city calls: 2/9 source-default Momondo rows, zero explicit two-adult rows |

| `experiments/032-one-star-property-basket/` | **COMPLETE — reject property-basket route** | Three one-city calls: zero qualifying explicit-two-adult named 1-star quotes across 12 searches |
| `experiments/033-one-star-aggregators/` | **COMPLETE — promote calibration candidate; reject product mapping** | Three one-city calls: 8/9 city-level rows, zero explicit two-adult occupancy |
| `experiments/034-one-star-aggregator-panel/` | **COMPLETE — reject complete panel; retain guarded fallback** | Ten one-city calls: 12/30 cells, one complete city, 2/9 holdout cells |
| `experiments/035-activity-budgetyourtrip/` | **COMPLETE — promote broader source validation; no product mapping** | Three one-city calls: 12/12 activity rows, all one-person/day |
| `experiments/036-activity-budgetyourtrip-panel/` | **COMPLETE — promote source contract; scaling/accuracy gates remain** | Ten one-city calls: 40/40 rows, 7 development/3 holdout, all one-person/day |
| `experiments/037-activity-definition-matched/` | **COMPLETE — reject definition-matched route** | Three one-city calls: 0/9 ticket/half-day/full-day rows passed frozen definitions |
| `experiments/038-one-star-budgetyourtrip-panel/` | **COMPLETE — retain guarded fallback; reject product mapping** | Twenty one-city calls: 17/20 rows, zero explicit two-adult occupancy |
| `experiments/039-hostel-private-boundary/` | **COMPLETE — retain dorm input; reject private mapping** | Six one-city calls: 6/6 dorm-bed inputs, 0/6 explicit two-adult private-room rows |
| `experiments/040-private-two-guest-search/` | **COMPLETE — promote property panel; reject city anchor** | Six one-city calls: 3/6 explicit two-adult named-hostel quotes, no city averages |
| `experiments/041-one-star-paired-calibration/` | **COMPLETE — reject paired calibration; retain guarded statistic** | Six one-city calls: 5/6 city statistics, 0/6 explicit two-adult one-star quotes |
| `experiments/042-registry-class-property-quotes/` | **COMPLETE — reject productive panel; retain guarded candidate** | Three one-city calls: 1/9 strict registry-joined property quotes, one identity warning |
| `experiments/043-google-hotels-one-star/` | **COMPLETE — reject broader route; retain single candidate** | Six one-city calls: 1/6 strict Google Hotels one-star quotes |

| `experiments/044-activity-operator-sources/` | **COMPLETE — reject operator route** | Six one-city calls, 18 searches: 0/18 strict activity cells; “From”/variable group prices |
| `experiments/045-trip-activity-definitions/` | **COMPLETE — reject Trip.com activity route** | Six one-city calls, 18 searches: 0/18 strict activity cells; “From” prices and missing definition fields |
| `experiments/046-official-activity-pages/` | **COMPLETE — reject complete route** | Six one-city calls, 18 searches: 0/18 strict cells; two budget rows had unknown tax |
| `experiments/047-accommodation-property-panel/` | **COMPLETE — promote private panel; reject one-star route** | Six one-city calls: private 3/6, one-star 1/6 strict quotes |
| `experiments/048-private-hostel-broad-panel/` | **COMPLETE — reject promotion gate** | Twelve one-city calls: 4/12 strict private-hostel quotes; no aggregation |
| `experiments/049-one-star-broad-panel/` | **COMPLETE — reject promotion gate** | Twelve one-city calls: 1/12 strict one-star quotes; no mapping |
| `experiments/050-tax-resolved-activity-ticket/` | **COMPLETE — reject promotion gate** | Six one-city calls: 2/6 strict tax-resolved tickets; no mapping |
| `experiments/051-minimal-anchor-panel/` | **COMPLETE — reject complete promotion** | Six one-city calls: no complete city; food/drink and attractions retained |
| `experiments/053-selector-occupancy-audit/` | **COMPLETE — reject promotion** | Twelve one-city calls: 0/12 strict, 7/12 selector-relaxed; below 8/12 gate |
| `experiments/052-three-star-broad-panel/` | **IN PROGRESS — three-star ground truth** | Twelve-city explicit two-adult three-star property panel; results pending |

The API key is optional for prompt feasibility: the delegated GPT-5.6 Luna-class sub-agent can run the
candidate contract without a provider credential. Provider API telemetry remains separately pending.

Experiment 052 is complete: its twelve one-city three-star property calls produced 0/12 strict quotes, so the
property route was rejected and one-room occupancy remains an explicit evidence requirement.

The inventory row for 052 above is a stale status label; the experiment directory and verdict are authoritative:
052 is complete and rejected (0/12 strict quotes).

The 053 selector-occupancy run has now completed: 0/12 strict and 7/12 selector-relaxed candidates, below the
8/12 promotion gate. Its relaxed label remains a hypothesis only.

| `experiments/055-skyscanner-class-panel/` | **COMPLETE - reject promotion** | Twelve one-city calls: 0/48 strict class rows; tax/class evidence blocked all |
| `experiments/056-agoda-one-three-star-panel/` | **COMPLETE - reject promotion** | Twelve one-city calls: 0/24 strict 1-/3-star rows; date/price/tax evidence blocked |
| `experiments/057-booking-class-tax-panel/` | **COMPLETE - reject promotion** | Twelve one-city calls: 0/24 strict 3-/4-star rows; class-page tax evidence blocked |
| `experiments/058-trip-class-tax-panel/` | **COMPLETE - reject promotion** | Twelve one-city calls: 0/36 strict 2-/3-/4-star rows; occupancy/tax evidence blocked |
| `experiments/059-expedia-class-panel/` | **COMPLETE - near-pass; 4-star gap** | Twelve one-city calls: 27/36 strict rows; 4-star 7/12, no mapping |
| `experiments/060-expedia-four-star-gap-panel/` | **COMPLETE - reject recovery gate** | Twelve one-city calls: 9/12 strict, 3/5 prior misses recovered; no mapping |
| `experiments/061-expedia-paired-panel/` | **COMPLETE - reject complete-city gate** | Twelve one-city calls: 26/36 strict rows, 5 complete; no mapping |
| `experiments/062-expedia-three-star-gap-panel/` | **COMPLETE - reject recovery gate** | Twelve one-city calls: 4/12 strict, 0/4 prior misses recovered; no mapping |
| `experiments/063-expedia-paired-panel-2/` | **COMPLETE - reject paired gate** | Twelve new one-city calls: 15/36 strict rows, one complete; no mapping |
| `experiments/064-expedia-pooled-ceiling-audit/` | **COMPLETE - reject fitting ceiling** | 80 rows/36 cities; 16 complete 2-/3-/4-star, no relationship fit-eligible |
| `experiments/065-expedia-one-star-paired-panel/` | **COMPLETE - reject one-star route** | Twelve one-city calls: 0/12 strict 1-star, 9/12 strict 3-star, no complete pair; no mapping |
| `experiments/066-budgetyourtrip-one-star-semantics/` | **COMPLETE - reject strict direct route** | Twelve one-city search+page-read calls: 0/12 explicit; source-defined double-occupancy proxy remains open; no mapping |
| `experiments/067-budgetyourtrip-double-occupancy-proxy/` | **COMPLETE - reject proxy gate** | Twelve one-city two-search/two-read calls: 1/12 proxy candidates, 12/12 protocol-compliant; no mapping |
| `experiments/068-budgetyourtrip-snippet-proxy/` | **COMPLETE - promote to calibration only** | Twelve one-city two-search calls: 10/12 proxy candidates, 12/12 protocol-compliant; no mapping |
| `experiments/069-budgetyourtrip-explicit-calibration/` | **COMPLETE - reject proxy calibration** | Twelve one-city five-search calls: 11/12 proxies, 0/12 matched explicit candidates, 12/12 protocol-compliant; no mapping |
| `experiments/070-private-hostel-three-source-panel/` | **COMPLETE - reject search-only route** | Twelve one-city three-search calls: 4/12 cities and 5 property rows, 12/12 protocol-compliant; no aggregation |
| `experiments/071-activity-per-person-scaling-panel/` | **COMPLETE - reject per-person screen** | Twelve one-city three-search calls: budget 3/12, mid 0/12, high 1/12, zero complete; no scaling or mapping |
| `experiments/072-priceoftravel-hostel-index-dorm/` | **COMPLETE - promote to scaling validation** | Twelve one-city search+page-read calls: 12/12 strict, 12/12 protocol-compliant; source window April 2023; no mapping |
| `experiments/073-priceoftravel-hostel-index-calibration/` | **COMPLETE - reject same-currency calibration** | Twelve one-city three-operation calls; 12/12 protocol-compliant, but only 1/12 same-currency matched pairs; no fitting or mapping |
| `experiments/074-hostelworld-shared-dorm-panel/` | **COMPLETE - reject source boundary** | Twelve one-city one-search calls; 0/12 strict current rows, 12/12 protocol-compliant; no scaling or mapping |
| `experiments/075-expedia-gap-panel/` | **COMPLETE - reject pooled fitting ceiling** | Twelve fresh one-city calls, 15 strict rows; pooled 20 2↔3 and 23 3↔4 matched cities, below 30; no fitting or mapping |
| `experiments/076-hotevi-grouped-tier-panel/` | **COMPLETE - promote to proxy calibration** | Twelve one-city HOTEVI calls, 36/36 grouped rows and 12/12 protocol-compliant; unknown occupancy/tax, no splitting or mapping |
| `experiments/077-hotevi-explicit-class-panel/` | **COMPLETE - reject direct page boundary** | Twelve one-city six-operation calls; 0/12 strict rows in every class and zero complete cities; grouped proxy remains only |
| `experiments/078-expedia-matched-panel/` | **COMPLETE - reject pooled fitting ceiling** | Twelve new one-city calls, eight strict rows; pooled 20 2↔3 and 26 3↔4 matched cities, below 30 |
| `experiments/079-hotevi-proxy-calibration/` | **COMPLETE - reject proxy calibration** | Eighteen complete grouped rows; 19 3-star and 15 4-star Expedia matches, below 30/10 gates |
| `experiments/080-activity-scaling-panel/` | **COMPLETE - promote scaling to definition validation** | 30/30 compliant, 28/30 complete tier sets; two-person scaling candidate, independent ground truth still missing |
| `experiments/081-activity-repeatability/` | **COMPLETE - reject complete repeatability gate** | 15/15 compliant; four cities stable, Fukuoka not-found in all three calls |
| `experiments/082-worldstaytracker-accommodation/` | **COMPLETE - reject promotion** | 12/12 compliant; 5 canonical 3-star rows, 0 four-star rows, 0 complete cities; breakfast/popular-property proxy only |
| `experiments/083-worldstaytracker-cityid-rating/` | **COMPLETE - reject promotion** | 12/12 compliant; 6 strict 3-star rows, 0 four-star rows, 0 complete cities; direct rating reads unsafe |
| `experiments/084-nomadlio-food-drink/` | **COMPLETE - reject product mapping** | 12/12 compliant; 64 proxy cells, 0 definition-compatible, 9 complete cities |

| `experiments/054-model-fit-adequacy/` | **COMPLETE — reject fitting** | 176 accepted direct rows; six relationships, none fit-eligible under 30-city/10-holdout gate |

The 053 selector-occupancy run has now completed: 0/12 strict and 7/12 selector-relaxed candidates, below the
8/12 promotion gate. Its relaxed label remains a hypothesis only.

Experiment 053 is complete and rejected: twelve one-city calls produced 0/12 strict and 7/12 selector-relaxed
occupancy candidates, below the 8/12 promotion gate. The relaxed label remains a hypothesis only.

Raw model responses, source captures, and generated reports must retain retrieval dates, schema/version
metadata, source URLs, currencies, and evidence basis. Do not store copied page content when a URL and
structured extracted facts are sufficient.
