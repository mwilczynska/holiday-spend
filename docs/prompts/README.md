# Prompt Contracts

> **Do not add status banners or commentary inside the prompt files themselves.** Several are read
> verbatim with `readFileSync` and sent to a model, so anything added to the file becomes part of the
> prompt. Status is recorded here instead.

| File | Status | Read by | Notes |
| --- | --- | --- | --- |
| `llm_prompt_new_cities_1.md` | **ACTIVE — shipping** | `src/lib/city-generation.ts` at runtime | The v1 city generation path. Every user-facing city cost comes from this |
| `llm_prompt_intercity_transport_1.md` | **ACTIVE — shipping** | `src/lib/transport-estimation.ts` | Planner intercity transport estimation. Unrelated to city costs |
| `llm_prompt_city_anchors_v4.md` | **ACTIVE — not yet wired up** | nothing yet | The v4 collection contract. Tested end to end but no ingestion path exists |
| `llm_prompt_city_cost_v5_experiment_001.md` | **EXPERIMENT — unvalidated** | `scripts/run-city-cost-v5-one-call.mjs` | Candidate 18-measure extractor; target-class prompt testing uses delegated Luna, provider telemetry remains pending |
| `llm_prompt_city_cost_v5_experiment_006.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Explicit source cascade and hard-category query budget; retest after Experiment 005 coverage failure |
| `llm_prompt_city_cost_v5_experiment_007.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Minimal nine-anchor candidate; tests whether modelling omitted targets is more feasible than direct 18-anchor extraction |
| `llm_prompt_city_cost_v5_experiment_009.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Narrow accommodation panel for class/occupancy source feasibility |
| `llm_prompt_city_cost_v5_experiment_010.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Date-fixed source-family contract for six accommodation classes |
| `llm_prompt_city_cost_v5_experiment_011.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Direct Booking/Trip/Hostelworld class-page template test |
| `llm_prompt_city_cost_v5_experiment_012.md` | **EXPERIMENT — unvalidated** | three independent delegated GPT-5.6 Luna-class invocations | Single-city production-shape repeatability and Copenhagen 4-star basis check |
| `llm_prompt_city_cost_v5_experiment_013.md` | **EXPERIMENT — unvalidated** | three independent delegated GPT-5.6 Luna-class invocations | One-city interactive official booking quote extraction with oracle URLs |
| `llm_prompt_city_cost_v5_experiment_014.md` | **EXPERIMENT — unvalidated** | three separate delegated GPT-5.6 Luna-class invocations | One-city Numbeo food/drink anchor extraction |
| `llm_prompt_city_cost_v5_experiment_015.md` | **EXPERIMENT — unvalidated** | two separate delegated GPT-5.6 Luna-class invocations | Canonical Numbeo city-name URL retest |
| `llm_prompt_city_cost_v5_experiment_016.md` | **EXPERIMENT — unvalidated** | two separate delegated GPT-5.6 Luna-class invocations | Numbeo-restricted search-snippet fallback |
| `llm_prompt_city_cost_v5_experiment_020_activities.md` | **EXPERIMENT — complete; promote attraction pattern only** | one city per delegated GPT-5.6 Luna-class invocation | Activity anchor search feasibility |
| `llm_prompt_city_cost_v5_experiment_021_accommodation_search.md` | **EXPERIMENT — complete; reject complete route** | one city per delegated GPT-5.6 Luna-class invocation | Accommodation class search feasibility |
| `llm_prompt_city_cost_v5_experiment_022_identity_cascade.md` | **EXPERIMENT — complete; promote bounded route** | one city per delegated GPT-5.6 Luna-class invocation | Bounded Numbeo city-identity cascade |
| `llm_prompt_city_cost_v5_experiment_024_accommodation_ground_truth.md` | **EXPERIMENT — complete; strict route rejected** | one city per delegated GPT-5.6 Luna-class invocation | Strict six-class accommodation panel; retrieval evidence only, revised boundary follows |
| `llm_prompt_city_cost_v5_experiment_025_accommodation_bed_boundary.md` | **EXPERIMENT — complete; boundary promoted** | one city per delegated GPT-5.6 Luna-class invocation | Tests explicit one-bed dorm inputs with deterministic two-traveller scaling |
| `llm_prompt_city_cost_v5_experiment_027_hotevi_tiers.md` | **EXPERIMENT — complete; production source rejected** | one city per delegated GPT-5.6 Luna-class invocation | Tests HOTEVI grouped 1–2/3/4–5-star source rows without mapping them to product classes |
| `llm_prompt_city_cost_v5_experiment_028_expedia_class_trends.md` | **EXPERIMENT — complete; 2–4-star route promoted for validation** | one city per delegated GPT-5.6 Luna-class invocation | Tests Expedia two-adult class-specific trend snippets; rejects from/lowest/event prices |
| `llm_prompt_city_cost_v5_experiment_030_one_star_source.md` | **EXPERIMENT — in progress** | one city per delegated GPT-5.6 Luna-class invocation | Tests Momondo/KAYAK 1-star candidates while preserving occupancy ambiguity |
| `llm_prompt_city_cost_v5_experiment_030_one_star_source.md` | **EXPERIMENT — complete; calibration only** | one city per delegated GPT-5.6 Luna-class invocation | Momondo candidates retained; occupancy unresolved, no product mapping |
| `llm_prompt_city_cost_v5_experiment_031_one_star_occupancy_calibration.md` | **EXPERIMENT — complete; route rejected** | one city per delegated GPT-5.6 Luna-class invocation | Tests Momondo candidates against explicit two-adult Skyscanner/Expedia rows; no calibration matches |
| `llm_prompt_city_cost_v5_experiment_032_one_star_property_basket.md` | **EXPERIMENT — complete; route rejected** | one city per delegated GPT-5.6 Luna-class invocation | Tests explicit two-adult named 1-star property quotes; no qualifying basket rows |
| `llm_prompt_city_cost_v5_experiment_033_one_star_aggregators.md` | **EXPERIMENT — complete; calibration candidate only** | one city per delegated GPT-5.6 Luna-class invocation | Tests city-level 1-star statistics from Trip.com, HotelsCombined, and Budget Your Trip |
| `llm_prompt_city_cost_v5_experiment_034_one_star_aggregator_panel.md` | **EXPERIMENT — complete; panel rejected** | one city per delegated GPT-5.6 Luna-class invocation | Ten-city source coverage/holdout test; Budget Your Trip retained only as guarded fallback |
| `llm_prompt_city_cost_v5_experiment_035_activity_budgetyourtrip.md` | **EXPERIMENT — complete; promote broader validation** | one city per delegated GPT-5.6 Luna-class invocation | Tests BudgetYourTrip per-person activity average and budget/mid/luxury entertainment rows |
| `llm_prompt_city_cost_v5_experiment_036_activity_budgetyourtrip_panel.md` | **EXPERIMENT — complete; promote source contract** | one city per delegated GPT-5.6 Luna-class invocation | Ten-city activity coverage panel with locked holdouts; all rows one-person/day |
| `llm_prompt_city_cost_v5_experiment_037_activity_definition_matched.md` | **EXPERIMENT — complete; route rejected** | one city per delegated GPT-5.6 Luna-class invocation | Tests low-cost ticket, half-day group, and full-day premium activity anchors against frozen definitions |
| `llm_prompt_city_cost_v5_experiment_038_one_star_budgetyourtrip_panel.md` | **EXPERIMENT — complete; guarded fallback only** | one city per delegated GPT-5.6 Luna-class invocation | Twenty-city one-star source expansion with zero-denominator and sample-size guards |
| `llm_prompt_city_cost_v5_experiment_039_hostel_private_boundary.md` | **EXPERIMENT — complete; retain dorm input, reject private mapping** | one city per delegated GPT-5.6 Luna-class invocation | Six-city hostel dorm/private boundary test with explicit occupancy gate |
| `llm_prompt_city_cost_v5_experiment_040_private_two_guest_search.md` | **EXPERIMENT — complete; promote property panel only** | one city per delegated GPT-5.6 Luna-class invocation | Six-city explicit two-guest private-hostel search; dated property quotes are not city averages |
| `llm_prompt_city_cost_v5_experiment_041_one_star_paired_calibration.md` | **EXPERIMENT — complete; reject paired calibration** | one city per delegated GPT-5.6 Luna-class invocation | Six-city BudgetYourTrip statistic plus Booking/Hotels explicit-occupancy pairing test |
| `llm_prompt_city_cost_v5_experiment_042_registry_class_property_quotes.md` | **EXPERIMENT — complete; reject productive panel** | one city per delegated GPT-5.6 Luna-class invocation | Frozen official-register class evidence joined to exact-property two-adult quotes |
| `llm_prompt_city_cost_v5_experiment_043_google_hotels_one_star.md` | **EXPERIMENT — complete; reject broader route** | one city per delegated GPT-5.6 Luna-class invocation | Six-city Google Hotels one-star property search with explicit tax/occupancy gates |
| `llm_prompt_city_cost_observations_1.md` | **ABANDONED (v3)** | `scripts/run-city-cost-research.ts` | v3 tooling. Kept only so `npm run methodology:research` still runs |

| `llm_prompt_city_cost_v5_experiment_044_activity_operator_sources.md` | **EXPERIMENT — complete; reject route** | one city per delegated GPT-5.6 Luna-class invocation | Six-city GetYourGuide/Viator activity-definition test; 0/18 strict cells |
| `llm_prompt_city_cost_v5_experiment_045_trip_activity_definitions.md` | **EXPERIMENT — complete; reject route** | one city per delegated GPT-5.6 Luna-class invocation | Six-city Trip.com activity-definition search; 0/18 strict cells |
| `llm_prompt_city_cost_v5_experiment_046_official_activity_pages.md` | **EXPERIMENT — complete; reject complete route** | one city per delegated GPT-5.6 Luna-class invocation | Six-city official activity-page test; 0/18 strict cells |
| `llm_prompt_city_cost_v5_experiment_047_accommodation_property_panel.md` | **EXPERIMENT — complete; promote private panel** | one city per delegated GPT-5.6 Luna-class invocation | Six-city explicit two-adult private-hostel and one-star property panel; private 3/6, one-star 1/6 |
| `llm_prompt_city_cost_v5_experiment_048_private_hostel_broad_panel.md` | **EXPERIMENT — complete; reject promotion gate** | one city per delegated GPT-5.6 Luna-class invocation | Twelve-city private-hostel panel; 4/12 strict quotes |
| `llm_prompt_city_cost_v5_experiment_049_one_star_broad_panel.md` | **EXPERIMENT — complete; reject promotion gate** | one city per delegated GPT-5.6 Luna-class invocation | Twelve-city one-star panel; 1/12 strict quotes |
| `llm_prompt_city_cost_v5_experiment_050_tax_resolved_activity_ticket.md` | **EXPERIMENT — complete; reject promotion gate** | one city per delegated GPT-5.6 Luna-class invocation | Six-city tax-resolved ticket test; 2/6 strict tickets |
| `llm_prompt_city_cost_v5_experiment_051_minimal_anchor_panel.md` | **EXPERIMENT — in progress** | one city per delegated GPT-5.6 Luna-class invocation | Six-city fixed four-search nine-anchor source-boundary test |
| `llm_prompt_city_cost_v5_experiment_053_selector_occupancy.md` | **COMPLETE — reject promotion** | one city per delegated GPT-5.6 Luna-class invocation | Twelve-city strict versus selector-relaxed occupancy semantic audit |

The 051 minimal-anchor prompt is complete as a source-boundary experiment: no city returned all nine anchors, so
the complete-contract promotion gate was rejected. The prompt remains reusable for model-boundary validation.

The 052 three-star property panel is complete and rejected: twelve independent one-city contexts returned 0/12
strict explicit-three-star/two-adult/one-room quotes. Do not infer one room from a two-adult selector; any relaxed
occupancy rule needs a new pre-registered estimand experiment and independent validation.

The 053 selector-occupancy prompt is active: one city per delegated Luna context, strict and selector-relaxed
statuses are recorded separately, and the relaxed status is only a semantic hypothesis pending independent
explicit-room validation.

The 053 run has completed and failed promotion at 7/12 relaxed candidates; keep the relaxed label as a hypothesis
until an independent explicit-room validation panel passes.

The 055 Skyscanner class-panel prompt is complete and rejected: twelve one-city contexts produced 0/48 strict
class rows because tax treatment or class/currency evidence failed; no city was complete.

The 056 Agoda one-/three-star panel is complete and rejected: twelve one-city contexts produced 0/24 strict rows;
date entry, numeric nightly price, one-room occupancy, and tax evidence did not co-occur.

The 057 Booking class-average tax panel is complete and rejected: twelve one-city contexts produced 0/24 strict
3-/4-star rows; class pages sometimes exposed numeric averages and selectors but not tax/fee treatment in the same
evidence. Do not map or fit from these rows.

The 058 Trip.com hotel-class tax panel is complete and rejected: twelve one-city contexts produced 0/36 strict
2-/3-/4-star rows because occupancy and tax evidence did not co-occur with the class averages. Do not map or fit
from these rows.

The 059 Expedia class-panel prompt is complete and near-pass: twelve new one-city contexts produced 27/36 strict
2-/3-/4-star trend rows (4-star 7/12), all with explicit two-adult and excluded-tax basis. Do not map or fit yet.

The 060 Expedia four-star gap prompt is complete and rejected at its recovery gate: 12 one-city contexts produced
9/12 strict rows overall and recovered 3/5 prior misses. It cannot amend the 059 gate or authorize mapping/fitting.

The 061 Expedia paired-panel prompt is complete and rejected at its complete-city gate: twelve new one-city contexts
produced 26/36 strict rows and five complete cities. Retain paired evidence; do not map or fit.

The 062 Expedia three-star gap prompt is complete and rejected: twelve one-city contexts produced 4/12 strict rows
and recovered 0/4 prior misses. Retain four rows as evidence; do not map or fit.

The 063 Expedia paired-panel tranche-2 prompt is complete and rejected: twelve entirely new cities produced 15/36
strict rows and one complete city. Retain rows for the pooled source-ceiling audit; no mapping or fitting.

The 065 Expedia one-star paired-panel prompt is complete and rejected: twelve one-city Luna contexts issued exactly
two ordered Expedia searches each and produced 0/12 strict 1-star rows, 9/12 strict 3-star rows, and no complete
pair. It does not authorize mapping or fitting; source-default one-star averages remain ineligible.

The 066 BudgetYourTrip one-star semantics prompt is complete for its strict direct-source question: twelve one-city
contexts used exactly one search and one exact-city page read, producing 0/12 explicit two-person rows. Eight pages
lacked row-level occupancy and four were blocked. This rejects direct observation, but source-level double-occupancy
proxy calibration remains a separate active question; numeric values are not yet product outputs.

The 067 BudgetYourTrip double-occupancy proxy prompt is complete and rejected at its screening gate: twelve one-city
contexts issued exactly two searches and two page reads each, yielding 1/12 proxy candidates and 12/12 protocol
compliance. No mapping or fitting follows; the Cairo candidate remains labelled proxy only.

The 068 BudgetYourTrip snippet-proxy prompt is complete and passes its screening gate: twelve one-city contexts used
exactly two ordered searches and no page reads, yielding 10/12 proxy candidates and 12/12 protocol compliance. This
only authorizes independent calibration; snippets remain lower-evidence proxies and cannot be mapped or fitted.

The 069 BudgetYourTrip explicit-calibration prompt is complete and rejected at its screening gate. Twelve one-city
contexts issued exactly five searches each; 11/12 had a proxy, but 0/12 had an independent explicit candidate. The
rejected direct-source evidence and all proxy rows remain labelled evidence only; no mapping or fitting follows.

The 070 private-hostel prompt is complete and rejected at its screening gate. Twelve one-city contexts issued exactly
three ordered search-only operations (Hostelworld, Booking.com, Google Hotels); 4/12 cities yielded five qualifying
property rows. No basket aggregation or product mapping follows.

The 071 activity prompt is complete and rejected at its feasibility gate. Twelve one-city contexts issued exactly three
searches; strict coverage was budget 3/12, mid-range 0/12, and high-end 1/12, with no complete city. Per-person facts
remain evidence only; no factor-of-two scaling or product mapping follows.

The 072 Price of Travel Hostel Index prompt is complete and passes its source screen: twelve one-city contexts each
performed exactly one restricted search and one exact-page read, yielding 12/12 strict rows. The tax-included reference
window is April 2023; deterministic two-bed scaling and independent validation are still required.

The 073 Price of Travel calibration prompt is complete and rejected: twelve one-city contexts each performed exactly
one index search, one exact-page read, and one current exact-property dorm search. All calls were compliant, but only
1/12 strict same-currency pairs were available (Lisbon's paired error was 38.76%). No correction, scaling, mapping,
or fitting follows. A deterministic-FX audit would be a separate experiment.

The 074 Hostelworld shared-dorm prompt is complete and rejected: twelve one-city contexts each performed exactly one
public Hostelworld search, with 12/12 protocol compliance but 0/12 strict rows. `From`/seasonal prices and missing
dates or tax basis dominated. No scaling or mapping follows.

The 075 Expedia gap-panel prompt is complete and rejected for promotion: twelve fresh one-city contexts performed
exactly three ordered Expedia-restricted 2-/3-/4-star searches, producing 15 strict rows. Pooling yielded 20 matched
2↔3 cities and 23 matched 3↔4 cities, below 30 for both; no fitting or mapping follows.

The 076 HOTEVI grouped-tier prompt is complete and passes its source screen: twelve one-city contexts produced 36/36
grouped rows with 12/12 protocol compliance. All rows remain source-defined standard-room proxies with unknown tax and
no individual-star or two-adult basis; only independent calibration is authorized.

The 077 HOTEVI explicit-class prompt is complete and rejected: twelve one-city contexts performed three HOTEVI class
search/read pairs each, with 12/12 protocol compliance but 0/12 strict rows for every class. Grouped research rows,
wrong-city pages, cache misses, and missing date/tax evidence dominated; no mapping follows.

The 078 Expedia matched-panel prompt is complete and rejected for promotion: twelve new one-city contexts performed
exactly three ordered Expedia 2-/3-/4-star searches and produced eight strict rows. Pooling reached 20 matched 2↔3
and 26 matched 3↔4 cities, below the 30-city gate; no fitting or product mapping is authorized.

The 079 HOTEVI proxy-calibration prompt is complete and rejected: eighteen new one-city contexts performed exactly
one HOTEVI search and one page read, all producing complete grouped proxies. Only 19 3-star and 15 4-star cities
matched strict Expedia targets, below the 30-city/10-holdout gates; no grouped class split or product mapping follows.

The 080 activity-scaling prompt is active: thirty new one-city contexts perform exactly two BudgetYourTrip searches
for Budget/Mid-Range/Luxury entertainment rows explicitly priced per person per day. Deterministic code may multiply
accepted inputs by two; the LLM may not calculate, and no product mapping is authorized before the source screen and
definition review. The screen completed with 30/30 compliant calls and 28/30 complete tier sets; it promotes only the
deterministic scaling candidate, not the product mapping. Fukuoka was not-found and Rome's multi-city itinerary rows
were rejected; independent activity ground truth remains required.

The 081 activity-repeatability prompt is active: five difficult cities receive three independent single-city calls
using the 080 two-search contract. It records dispersion and missingness only; no cross-call averaging, arithmetic,
or product mapping is authorized. The run completed 15/15 compliant calls; four cities were stable and Fukuoka was
not-found in all three calls, so the five-city repeatability gate failed.

The 082 World Stay Tracker accommodation prompt is complete and rejected: twelve independent one-city calls performed
exactly four ordered operations (3-star search/read, then 4-star search/read). The audit accepted five canonical
3-star rows and zero 4-star rows, with zero complete cities; two equivalent 3-star rows failed canonical field
validation. Breakfast-included/popular-property semantics remain labelled evidence only, with no mapping authorized.

The 083 World Stay Tracker cityid/rating prompt is complete and rejected: twelve independent one-city calls performed
one search, one returned-page read, and one direct read after substituting only the URL's `rating=4` parameter. Six
strict 3-star rows and zero 4-star rows passed; every direct 4-star read was unsafe or unavailable. No fallback or
product mapping is authorized.

Experiment 064 has no prompt: it is a deterministic pooled audit of existing evidence. It found 80 rows across 36
cities, but no 30-city/10-holdout relationship and zero one-star/hostel rows. Do not fit or map.

The 030 one-star prompt is now complete as a calibration-only experiment: its three Momondo candidates had
unknown or source-default occupancy and must not be mapped to `accom_1_star`. The v5 experiment prompt includes
auxiliary `mcmeal_combo`; it is never silently substituted for a missing street-food anchor.

| `llm_prompt_city_cost_v5_experiment_055_skyscanner_class_panel.md` | **COMPLETE - reject promotion** | one city per delegated GPT-5.6 Luna-class invocation | Twelve-city four-class panel; 0/48 strict rows |
| `llm_prompt_city_cost_v5_experiment_056_agoda_one_three_star.md` | **COMPLETE - reject promotion** | one city per delegated GPT-5.6 Luna-class invocation | Twelve-city 1-/3-star panel; 0/24 strict rows |
| `llm_prompt_city_cost_v5_experiment_057_booking_class_tax_panel.md` | **COMPLETE - reject promotion** | one city per delegated GPT-5.6 Luna-class invocation | Twelve-city 3-/4-star panel; 0/24 strict rows |

## Known defect in the shipping prompt

`llm_prompt_new_cities_1.md` asserts `accom_4_star = hotel_3star_2p × 1.80`. That constant has been
**measured and refuted** — it overpredicts 14 of 16 tested cities with a median absolute error of 38.8%,
reaching +80.1% in San Francisco, and the observed IQR (1.257–1.555) does not contain 1.800.

It is deliberately still in place because no replacement path is built yet. Do not "fix" the constant in
isolation: the whole derivation moves to the v4 calculator. See `/PLAN.md`.

## `llm_prompt_city_anchors_v4.md` is generated

It is extracted from §9.1 of `docs/product/methodology-v4.md`, which is the source of truth.
**Never edit the prompt file directly** — edit the methodology and regenerate, or the two will drift.
