# v6.1 development release report

**Status:** reachable release replay; not holdout validation  
**Generated:** 2026-08-10  
**Panel:** 25 development cities × 19 product tiers  
**Holdout:** no holdout read; all v6.0 holdout measures remain spent/closed  
**Shipping CSV:** read-only informational comparison; SHA-256 0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8

## Result

All 19 existing product tiers materialize as finite, non-negative, provenance-bearing values for 25/25
development fixtures through the v6.1 collector contract and materializeCityCostV61. This is a deterministic
development replay, not an accuracy claim against independent ground truth. Food and activities are
BudgetYourTrip source-backed product estimates; drinks are source-priced consumption presets; only the
accommodation ladder has the banked independent Booking development accuracy result.

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
| `drink_coffee` | cappuccino_1 | A / ±10% | 13 direct / 12 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 37.6% median APE |
| `drinks_none` | 2 * cappuccino_1 | A / ±10% | 13 direct / 12 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 37.6% median APE |
| `drinks_light` | 2 * cappuccino_1 + 2 * domestic_draft_beer_1 | A / ±10% | 13 direct / 12 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 17.42% median APE |
| `drinks_moderate` | 2 * cappuccino_1 + 4 * domestic_draft_beer_1 + 2 * cocktail_1 | C / ±75% | 13 direct / 12 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 14.92% median APE |
| `drinks_heavy` | 2 * cappuccino_1 + 6 * domestic_draft_beer_1 + 4 * cocktail_1 | C / ±75% | 13 direct / 12 fallback | direct vector → regional → global | source-backed/preset; no independent fit | not evaluated; holdout closed | 25.57% median APE |
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
| drinks | 13 | 12 | 52% | 48% |
| activities | 24 | 1 | 96% | 4% |

Materialized grade distribution across all 25 × 19 tier cells: C=126, B=164, D=121, A=39, definitional=25.

Fallback is exactly one layer: direct category tier vector → regional tier vector → global tier vector.
The generated v6.1 priors are in data/reference/v6/priors-v6-1.json; the historical v6.0 priors remain
separate. 8 source rows were excluded from prior construction because the frozen FX
snapshot lacks SGD, TWD, ZAR or PEN; the exclusions are recorded in that generated file.

## Banked accommodation result

The genuine independent Booking development results are carried forward without refit: 3-star 8.27%,
4-star 13.12%, private hostel 15.97%, 2-star 16.74%, 1-star 21.49% and dorm 25.46% median APE. No v6.1
holdout or new accommodation collection was used.

## Release gate interpretation

- Output coverage, schema/missingness, provenance/grades, algebraic coherence and deterministic replay pass.
- Refresh economics pass: three source calls, at most ten searches, zero direct page reads.
- Integration is new-city-only behind CITY_COST_METHODOLOGY_V6=true; unsetting the flag retains v1.
- Independent food, drink and activity accuracy is not claimed. BYT is the production source for food/activity,
  and no independent full-basket drink panel exists in v6.1.
- The 121-city CSV was not modified. M4 migration remains a separate future decision.
