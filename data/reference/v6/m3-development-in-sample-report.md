# v6 M3 development in-sample report

This report is generated from `coefficients-v6.json` and the paired development score in
`experiments/005-development-in-sample-score/results.json`. It never reads a holdout file.

**IN-SAMPLE ONLY.** These figures are development diagnostics, not holdout validation and not gate passes.

Prediction coverage: 25/25 cities.
Tier coverage: 10 evaluable, 1 definitional, 8 blocked.

| Product tier | Derivation | Grade | Interval | Development fit | In-sample result | v1 comparison |
| --- | --- | --- | --- | --- | --- | --- |
| `accom_shared_hostel_dorm` | accom_shared_hostel_dorm <- accom_3_star | C | ±54% | n=25; k=0.2955; LOO medAPE 20.92%, p90 53.16% | IN-SAMPLE n=25; medAPE 25.46%; signed 22.06% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_hostel_private_room` | rollback; diagnostic fit retained | C | ±35% | direct anchor, basket or documented fallback | IN-SAMPLE n=25; medAPE 15.97%; signed -15.81% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_1_star` | interpolated geometric mean | C | ±45% | direct anchor, basket or documented fallback | IN-SAMPLE n=22; medAPE 21.490000000000002%; signed -2.085% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_2_star` | accom_2_star <- accom_3_star | C | ±25% | n=25; k=0.8182; LOO medAPE 17.85%, p90 37.71% | IN-SAMPLE n=25; medAPE 16.74%; signed 0.38% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_3_star` | production Expedia anchor; Booking -> Expedia offset | B | ±20% | direct anchor, basket or documented fallback | IN-SAMPLE n=25; medAPE 8.27%; signed 5.68% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_4_star` | accom_4_star <- accom_3_star | C | ±25% | n=26; k=1.3372; LOO medAPE 12.98%, p90 27.18% | IN-SAMPLE n=25; medAPE 13.12%; signed 3.88% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_street_food` | measured street_food_meal_1p <- inexpensive_restaurant_meal_1p; n=6 | C | ±336% | n=6; k=0.3248; LOO medAPE 100.73%, p90 335.59% | NOT EVALUABLE — no direct daily tier truth; street-food relation is checked only through the BYT food basket | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_budget` | fixed basket | C | derived from ±336% street relation | direct anchor, basket or documented fallback | IN-SAMPLE n=24; medAPE 14.555%; signed 0.01% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_mid_range` | fixed basket plus midrange relation | C | derived from input intervals | n=10; k=4.9062; LOO medAPE 21.53%, p90 45.63% | IN-SAMPLE n=24; medAPE 14.335%; signed 0% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_high_end` | fixed basket plus grade-D premium fallback | D | ±45% premium fallback; basket widens | direct anchor, basket or documented fallback | IN-SAMPLE n=24; medAPE 13.76%; signed 0% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drink_coffee` | production Numbeo anchor | A | ±10% | direct anchor, basket or documented fallback | NOT EVALUABLE — no independent full-basket drink truth; Expatistan cocktail does not validate Numbeo coffee | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_none` | fixed basket | A | derived from cappuccino | direct anchor, basket or documented fallback | NOT EVALUABLE — no independent full-basket drink truth | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_light` | fixed basket | A | derived from cappuccino and beer | direct anchor, basket or documented fallback | NOT EVALUABLE — only 3/25 Expatistan neighbourhood-pub beer rows; no full independent drink basket | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_moderate` | fixed basket plus cocktail relation | C | derived from ±75% cocktail relation | n=11; k=2.6; LOO medAPE 17.47%, p90 74.17% | NOT EVALUABLE — cocktail-only evidence cannot validate the full coffee/beer/cocktail basket | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_heavy` | fixed basket without wine glass | C | derived from cocktail relation; wine excluded | direct anchor, basket or documented fallback | NOT EVALUABLE — wine glass was intentionally excluded and no independent full basket exists | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_free` | definition | definitional | 0% | direct anchor, basket or documented fallback | DEFINITIONAL — not scored | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_budget` | production BudgetYourTrip anchor; official-attraction truth check | B | ±20% | direct anchor, basket or documented fallback | IN-SAMPLE n=20; medAPE 54.185%; signed 3.005% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_mid_range` | production BudgetYourTrip proxy; independent validation blocked | C | ±35% | direct anchor, basket or documented fallback | NOT EVALUABLE — BudgetYourTrip is the production source; no independent half-day tier source | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_high_end` | production BudgetYourTrip proxy; independent validation blocked | C | ±35% | direct anchor, basket or documented fallback | NOT EVALUABLE — BudgetYourTrip is the production source; no independent full-day tier source | NOT EVALUABLE — no complete all-19 development truth comparison |

## Gates 2–6 (development)

| Gate | Status | Reason |
| --- | --- | --- |
| Gate 2 tier accuracy | in_sample_partial | 10 tiers have paired in-sample truth; blocked tiers are not failures. |
| Gate 3 city ranking | not_evaluable | The development panel lacks complete independent truth for the 19-tier daily basket: street food has no direct daily-tier truth, all five drink tiers are blocked, and BudgetYourTrip mid/high activities are circular. |
| Gate 4 cost bands | not_evaluable | A complete independent product-level cost-band truth is not available for the development cities; the frozen manifest band cannot be treated as an independent full-basket observation. |
| Gate 5 trip realism | not_evaluable | Trip totals require an independent full daily basket, but drinks and two activity tiers remain blocked and street food has no direct daily-tier truth. |
| Gate 6 no regression vs v1 | not_evaluable | The available development truth does not cover all 19 product tiers, so no all-tier comparison against v1 can be made without turning partial evidence into a gate result. |

The spent holdout remains closed. The fresh holdout proposal remains uncollected and requires owner approval.
