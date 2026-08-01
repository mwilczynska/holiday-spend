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
