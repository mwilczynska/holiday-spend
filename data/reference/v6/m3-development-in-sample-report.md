# v6 M3 development in-sample report

This report is generated from `coefficients-v6.json` and the paired development score in
`experiments/005-development-in-sample-score/results.json`. It never reads a holdout file.

**IN-SAMPLE ONLY.** These figures are development diagnostics, not holdout validation and not gate passes.

Prediction coverage: 25/25 cities.
Tier coverage: 9 evaluable, 1 definitional, 8 blocked, 1 not evaluable.

| Product tier | Derivation | Grade | Interval | Development fit | In-sample result | v1 comparison |
| --- | --- | --- | --- | --- | --- | --- |
| `accom_shared_hostel_dorm` | accom_shared_hostel_dorm <- accom_3_star | C | ±54% | n=25; k=0.2955; LOO medAPE 20.92%, p90 53.16% | IN-SAMPLE n=25; medAPE 25.46%; signed 22.06% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_hostel_private_room` | rollback; diagnostic fit retained | C | ±35% | direct anchor, basket or documented fallback | IN-SAMPLE n=25; medAPE 15.97%; signed -15.81% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_1_star` | interpolated geometric mean | C | ±45% | direct anchor, basket or documented fallback | IN-SAMPLE n=22; medAPE 21.490000000000002%; signed -2.085% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_2_star` | accom_2_star <- accom_3_star | C | ±25% | n=25; k=0.8182; LOO medAPE 17.85%, p90 37.71% | IN-SAMPLE n=25; medAPE 16.74%; signed 0.38% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_3_star` | production Expedia anchor; Booking -> Expedia offset | B | ±20% | direct anchor, basket or documented fallback | IN-SAMPLE n=25; medAPE 8.27%; signed 5.68% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `accom_4_star` | accom_4_star <- accom_3_star | C | ±25% | n=26; k=1.3372; LOO medAPE 12.98%, p90 27.18% | IN-SAMPLE n=25; medAPE 13.12%; signed 3.88% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_street_food` | global prior fallback; measured n=6 relation retained as diagnostic only | D | +/-45% | n=6; k=0.3248; LOO medAPE 100.73%, p90 335.59% | NOT EVALUABLE — no direct daily tier truth; street-food relation is checked only through the BYT food basket | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_budget` | fixed basket; observed inexpensive anchor required for score | D | derived from street prior +/-45% | direct anchor, basket or documented fallback | IN-SAMPLE n=14; medAPE 24.22%; signed -24.22% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_mid_range` | fixed basket plus midrange relation; observed source anchors required for score | D | derived from street prior +/-45% | n=10; k=4.9062; LOO medAPE 21.53%, p90 45.63% | IN-SAMPLE n=13; medAPE 37.4%; signed -37.4% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `food_high_end` | fixed basket plus grade-D premium fallback | D | ±45% premium fallback; basket widens | direct anchor, basket or documented fallback | IN-SAMPLE n=13; medAPE 51.99%; signed -51.99% | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drink_coffee` | production Numbeo anchor | A | ±10% | direct anchor, basket or documented fallback | NOT EVALUABLE — no independent full-basket drink truth; Expatistan cocktail does not validate Numbeo coffee | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_none` | fixed basket | A | derived from cappuccino | direct anchor, basket or documented fallback | NOT EVALUABLE — no independent full-basket drink truth | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_light` | fixed basket | A | derived from cappuccino and beer | direct anchor, basket or documented fallback | NOT EVALUABLE — only 3/25 Expatistan neighbourhood-pub beer rows; no full independent drink basket | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_moderate` | fixed basket plus cocktail relation | C | derived from ±75% cocktail relation | n=11; k=2.6; LOO medAPE 17.47%, p90 74.17% | NOT EVALUABLE — cocktail-only evidence cannot validate the full coffee/beer/cocktail basket | NOT EVALUABLE — no complete all-19 development truth comparison |
| `drinks_heavy` | fixed basket without wine glass | C | derived from cocktail relation; wine excluded | direct anchor, basket or documented fallback | NOT EVALUABLE — wine glass was intentionally excluded and no independent full basket exists | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_free` | definition | definitional | 0% | direct anchor, basket or documented fallback | DEFINITIONAL — not scored | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_budget` | production BudgetYourTrip daily-spend anchor; ticket observations withdrawn as mismatched truth | B | ±20% | direct anchor, basket or documented fallback | NOT EVALUABLE — The 25 official-attraction rows measure two single-admission tickets, while the production tier is two-person daily activity spend. They are valid ticket observations but not truth for this tier. | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_mid_range` | production BudgetYourTrip daily-spend proxy; independent validation blocked | C | ±35% | direct anchor, basket or documented fallback | NOT EVALUABLE — BudgetYourTrip is the production source; no independent half-day tier source | NOT EVALUABLE — no complete all-19 development truth comparison |
| `activities_high_end` | production BudgetYourTrip daily-spend proxy; independent validation blocked | C | ±35% | direct anchor, basket or documented fallback | NOT EVALUABLE — BudgetYourTrip is the production source; no independent full-day tier source | NOT EVALUABLE — no complete all-19 development truth comparison |

## Gates 2–6 (development)

| Gate | Status | Reason |
| --- | --- | --- |
| Gate 2 tier accuracy | in_sample_partial | 9 tiers have paired in-sample truth; blocked and not-evaluable tiers are not failures. |
| Gate 3 city ranking | not_evaluable | The development panel lacks complete independent truth for the 19-tier daily basket: street food has no direct daily-tier truth, all five drink tiers are blocked, the activity budget truth is a ticket/daily-spend estimand mismatch, and BudgetYourTrip mid/high activities are circular. |
| Gate 4 cost bands | not_evaluable | A complete independent product-level cost-band truth is not available for the development cities; the frozen manifest band cannot be treated as an independent full-basket observation. |
| Gate 5 trip realism | not_evaluable | Trip totals require an independent full daily basket, but drinks and two activity tiers remain blocked and street food has no direct daily-tier truth. |
| Gate 6 no regression vs v1 | not_evaluable | The available development truth does not cover all 19 product tiers, so no all-tier comparison against v1 can be made without turning partial evidence into a gate result. |


## Food score eligibility

Food rows are scored only where the required production Numbeo anchors were observed. Derived street-food and premium anchors do not count as independent observations; cities with imputed source anchors are excluded.

- `food_budget`: n=14; required observed anchors: inexpensive_restaurant_meal_1p; excluded 11: Singapore, Taipei, Colombo, Mumbai, Istanbul, Dubai, Cairo, Cape Town, Nairobi, Prague, Lima
- `food_mid_range`: n=13; required observed anchors: inexpensive_restaurant_meal_1p, midrange_restaurant_meal_2p; excluded 12: Singapore, Taipei, Colombo, Mumbai, Istanbul, Dubai, Cairo, Cape Town, Nairobi, Budapest, Prague, Lima
- `food_high_end`: n=13; required observed anchors: inexpensive_restaurant_meal_1p, midrange_restaurant_meal_2p; excluded 12: Singapore, Taipei, Colombo, Mumbai, Istanbul, Dubai, Cairo, Cape Town, Nairobi, Budapest, Prague, Lima

## Food basket diagnosis (existing data; in-sample)

This screen uses the existing production bundles and BYT food truth only. It does not read a holdout, make provider calls, or change coefficients.

| Food tier | Food only | + drinks_none | + drinks_light |
| --- | ---: | ---: | ---: |
| `food_budget` | 0.76x | 0.90x | 1.04x |
| `food_mid_range` | 0.63x | 0.66x | 0.70x |
| `food_high_end` | 0.48x | 0.50x | 0.51x |

At budget, adding the product's beverage tiers moves the prediction from 0.76x to 0.90x and then 1.04x of BYT food truth. That near-closure is a category-boundary artifact: BYT Food & Meals evidently includes beverages that the product books under drinks. At mid and high, the same additions move 0.63x to 0.70x and 0.48x to 0.51x; the remaining under-prediction is a genuine basket-composition question.

### Basket-weight re-fit (diagnostic only)

Because street food is a fixed multiple of inexpensive food and premium is a fixed multiple of midrange, raw basket terms are collinear. The fitted values below are identifiable effective weights and are not shipped.

| Tier | n | Current effective weights | Fitted effective weights | Current LOO medAPE / p90 | Reweighted LOO medAPE / p90 | Beats current on both? |
| --- | ---: | --- | --- | ---: | ---: | --- |
| `food_mid_range` | 13 | inexpensive 2.5514; midrange 1 | inexpensive 1.7674; midrange 1.3618 (nonnegative_ols) | 37.41% / 46.92% | 36.98% / 48.39% | no |
|  |  |  | Full-panel medAPE 32.93%; signed residual dispersion min / Q1 / Q3 / max: -46.75% / -35.03% / 2.62% / 37.86% |  | LOO signed residual dispersion min / Q1 / Q3 / max: -48.39% / -37.53% / 2.82% / 63.45% |  |
| `food_high_end` | 13 | inexpensive 2; midrange 2.5 | inexpensive 0; midrange 4.2724 (nnls_midrange_only) | 51.99% / 61% | 29.82% / 47.21% | yes |
|  |  |  | Full-panel medAPE 29.27%; signed residual dispersion min / Q1 / Q3 / max: -42.55% / -31.5% / -3.84% / 42.6% |  | LOO signed residual dispersion min / Q1 / Q3 / max: -47.21% / -34.99% / -3.87% / 69.38% |  |

The mid-range re-fit improves LOO median APE by 0.43 percentage points but worsens p90 by 1.47 points, so it does not beat the current basket on both criteria. The high-end re-fit beats it on both (LOO median APE 29.82% vs 51.99%; p90 47.21% vs 61.00%). Neither re-weighting is shipped; the high-end result is a candidate for a separately reviewed model change.

### Numbeo observation coverage by region

Rates below are for the five Numbeo production anchors in the 25-city development prediction bundles. The food score therefore runs on a Western/East-Asian-leaning subsample and may not generalise to cities with weak Numbeo coverage.

| Region | Cities | Inexpensive | Midrange | Cappuccino | Draft beer | McMeal | All five |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Africa | 3 | 0% | 0% | 0% | 0% | 0% | 0% |
| East Asia | 4 | 75% | 75% | 75% | 75% | 75% | 75% |
| Europe | 4 | 75% | 50% | 75% | 50% | 50% | 50% |
| Latin America | 2 | 50% | 50% | 50% | 50% | 50% | 50% |
| Middle East | 2 | 0% | 0% | 0% | 0% | 0% | 0% |
| North America | 1 | 100% | 100% | 100% | 100% | 100% | 100% |
| Oceania | 1 | 100% | 100% | 100% | 100% | 100% | 100% |
| SEA | 5 | 80% | 80% | 80% | 80% | 80% | 80% |
| South Asia | 3 | 33.3% | 33.3% | 33.3% | 33.3% | 33.3% | 33.3% |

Overall food-anchor observation rates are inexpensive 14/25 (56%), midrange 13/25 (52%), and all-five 13/25 (52.0%).

The spent holdout remains closed. The fresh holdout proposal remains uncollected and requires owner approval.
