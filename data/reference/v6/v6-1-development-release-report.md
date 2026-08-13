# v6.1 development release report

**Status:** scored_development_failed
**Generated:** 2026-08-12
**Panel:** 25 development cities × 19 product tiers  
**Holdout:** no holdout read; all v6.0 holdout measures remain spent/closed  
**Shipping CSV:** read-only informational comparison; SHA-256 0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8

**Migration:** owner-approved staged migration of the 121-city library; live CSV remains unchanged pending
owner resolution of the failed experiment-013 canary, a complete staged artifact, user-key transport smoke
and owner review.

**Delegated canary history:** Experiment 013 is the latest complete-frame attempt recorded by the active
manifest and remains an immutable failure. Its 60 slots are terminal and 19/20 cities completed, but a
duplicate Prague assignment invalidated two call records and exceeded the frozen call/search contract.
Experiment 012 remains immutable incomplete-orchestration evidence, while 011 remains the earlier 17/20
boundary failure. None is promoted to a release pass.

**Generated coefficient contract:** consistent —
{"appliedTo":"cappuccino_1","k":2.4838,"grade":"C","intervalPct":64}

## Result

All 19 existing product tiers materialize as finite, non-negative, provenance-bearing values for 25/25
development fixtures through the v6.1 collector contract and materializeCityCostV61. This is a deterministic
development replay, not an accuracy claim against independent ground truth. Food and activities are
BudgetYourTrip source-backed product estimates; drinks are source-priced consumption presets; only the
accommodation ladder has the banked independent Booking development accuracy result.

Development fixture coverage is measured at 25/25
cities with 25 complete 19-tier bundles. Runtime coverage is
**unmeasured**, not measured by this fixture replay. The manifest's
95% target is a post-release operational SLO and is not reported
as passed from either fixture replay or a 19/20 sample.

## Tier report

| Tier | v6.1 derivation | Grade / interval | Development coverage | Fallback path | Development fit | Holdout | v1 median APE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `accom_shared_hostel_dorm` | 2 * 0.2955 * hotel_3star_room_2p | C / ±54% | 20 direct / 5 fallback | 3-star source/prior → banked ladder | banked 25.46% median APE | not evaluated; holdout closed | 67.7% median APE |
| `accom_hostel_private_room` | 0.5919 * hotel_3star_room_2p | C / ±41% | 20 direct / 5 fallback | 3-star source/prior → banked ladder | banked 15.97% median APE | not evaluated; holdout closed | 41.81% median APE |
| `accom_1_star` | 0.6663 * hotel_3star_room_2p | C / ±45% | 20 direct / 5 fallback | 3-star source/prior → banked ladder | banked 21.49% median APE | not evaluated; holdout closed | 55.35% median APE |
| `accom_2_star` | 0.75 * hotel_3star_room_2p | C / ±41% | 20 direct / 5 fallback | 3-star source/prior → banked ladder | banked 16.74% median APE | not evaluated; holdout closed | 38.18% median APE |
| `accom_3_star` | hotel_3star_room_2p | B / ±41% | 20 direct / 5 fallback | 3-star source/prior → banked ladder | banked 8.27% median APE | not evaluated; holdout closed | 38.17% median APE |
| `accom_4_star` | 1.3372 * hotel_3star_room_2p | C / ±41% | 20 direct / 5 fallback | 3-star source/prior → banked ladder | banked 13.12% median APE | not evaluated; holdout closed | 28.71% median APE |
| `food_street_food` | (6 * 0.2757) / (4 * 0.2757 + 2) * food_budget | D / ±45% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 24.94% median APE |
| `food_budget` | 2 * byt_food_budget_per_person_day | B / ±35% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 36.29% median APE |
| `food_mid_range` | 2 * byt_food_mid_per_person_day | B / ±35% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 52.08% median APE |
| `food_high_end` | 2 * byt_food_high_per_person_day | B / ±35% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 156.87% median APE |
| `drink_coffee` | cappuccino_1 | A / ±10% | 17 direct / 8 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 33.5% median APE |
| `drinks_none` | 2 * cappuccino_1 | A / ±10% | 17 direct / 8 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 33.5% median APE |
| `drinks_light` | 2 * cappuccino_1 + 2 * domestic_draft_beer_1 | A / ±10% | 17 direct / 8 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 16.02% median APE |
| `drinks_moderate` | 2 * cappuccino_1 + 4 * domestic_draft_beer_1 + 2 * cocktail_1 | C / ±64% | 17 direct / 8 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 12.81% median APE |
| `drinks_heavy` | 2 * cappuccino_1 + 6 * domestic_draft_beer_1 + 4 * cocktail_1 | C / ±64% | 17 direct / 8 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 26.39% median APE |
| `activities_free` | 0 by definition | definitional / ±0% | 25 direct / 0 fallback | definitional zero | source-backed/preset; no independent fit | not evaluated; holdout closed | n/a |
| `activities_budget` | 2 * byt_activities_budget_per_person_day | B / ±35% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 31.8% median APE |
| `activities_mid_range` | 2 * byt_activities_mid_per_person_day | B / ±35% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 35% median APE |
| `activities_high_end` | 2 * byt_activities_high_per_person_day | B / ±35% | 24 direct / 1 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 34.1% median APE |

The v1 column is an informational A/B comparison against the unchanged 121-city CSV, not a ground-truth
score. All 25 development city rows were present in the CSV.

## Source and fallback coverage

| Category | Direct cities | Fallback cities | Direct rate | Fallback rate |
| --- | ---: | ---: | ---: | ---: |
| accommodation | 20 | 5 | 80% | 20% |
| food | 24 | 1 | 96% | 4% |
| drinks | 17 | 8 | 68% | 32% |
| activities | 24 | 1 | 96% | 4% |

## Frozen FX coverage maintenance

The 22 July frozen FX snapshot now includes SGD, TWD, ZAR, PEN with source-attributed
rates. Direct Numbeo drink coverage increased from 13/25 cities to
17/25; the remaining drink fallbacks are explicit and unchanged
in kind. This is FX metadata maintenance, not new city-price collection.

Materialized grade distribution across all 25 × 19 tier cells: C=134, B=164, D=101, A=51, definitional=25.

Fallback is exactly one layer: direct category tier vector → regional tier vector → global tier vector.
The generated v6.1 priors are in data/reference/v6/priors-v6-1.json; the historical v6.0 priors remain
separate. 0 source rows were excluded from prior construction because the frozen FX
snapshot lacks SGD, TWD, ZAR or PEN; the exclusions are recorded in that generated file.

## Banked accommodation result

The genuine independent Booking development results are carried forward without refit: 3-star 8.27%,
4-star 13.12%, private hostel 15.97%, 2-star 16.74%, 1-star 21.49% and dorm 25.46% median APE. No v6.1
holdout or new accommodation collection was used.

## Release gate interpretation

| Gate | Result | Evidence |
| --- | --- | --- |
| 1_developmentFixtureCoverage | PASS | Computed by the release validator. |
| 2_schemaAndMissingness | PASS | Computed by the release validator. |
| 3_provenanceAndGrades | PASS | Computed by the release validator. |
| 4_algebraicCoherence | PASS | Computed by the release validator. |
| 5_accommodationAccuracy | PASS | Computed by the release validator. |
| 6_sourceDependenceDisclosure | PASS | Computed by the release validator. |
| 7_deterministicReplay | PASS | Computed by the release validator. |
| 8_refreshEconomics | PASS | Computed by the release validator. |
| 9_integrationAndRollback | PASS | Computed by the release validator. |
| 1_runtimeCoverage | UNMEASURED (not a pass) | Runtime complete-generation coverage >=95% is an unmeasured post-release operational SLO; development replay and a 19/20 canary do not establish it. |
| 1_delegatedOperationalCanary | FAILED (not a pass) | At least 19/20 registered cities have three schema-valid delegated source records and complete shipped Stage-B materializations; every call/search/read/provenance gate passes and artifact candidates, including all-prior cities, affect no more than 30% of the batch. Artifact data/reference/v6/experiments/013-v6-1-resumable-delegated-canary/results.json @ 8fdfd5b577498f9ae27af79f7ad50653819e0ceff60ad3de26d1b057cb755c64; experiment 013-v6-1-resumable-delegated-canary: 19/20 complete, 0 artifact candidates (0.0%), result pass=false. Incident data/reference/v6/experiments/013-v6-1-resumable-delegated-canary/collection-incidents.json @ f4e7dd31ef81bea54788d7fee015b8b081718407994650537d9c3f9588624a46. |
| 10_verification | EXTERNAL (not a pass) | Verification baseline is executed outside this data replay. See the command log and CI/owner-run baseline; this validator does not claim it passed. |

Gate 10 is an external verification-baseline status, not something this data replay can observe. The
validator records it explicitly rather than silently omitting it. Independent food, drink and activity
accuracy is not claimed: BYT is the production source for food/activity, and no independent full-basket
drink panel exists in v6.1. The 121-city CSV was not modified. The rollout preview is operational impact
evidence only; it does not replace collection-boundary repair, the delegated operational canary, the
user-key provider smoke or owner-reviewed staged migration.
