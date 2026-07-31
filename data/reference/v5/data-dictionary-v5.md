# City Cost v5 Data Dictionary

**Status:** Frozen for v5 Experiment 000 unless a dated decision is recorded in `PLAN.md` before the
affected holdout is used.

## Shared rules

- City values are base costs for two travellers, ultimately in AUD.
- Accommodation is per room/bed night; food, drinks, and activities are per day.
- Source facts are retained in the source currency. FX conversion occurs once in deterministic code from
  a dated, versioned rate table.
- A price is the standard publicly available rate for the stated unit, excluding member/login-only rates,
  discounts requiring an account, and unlabelled promotional pricing.
- Taxes and mandatory fees are included when the source states they are included. If their treatment is
  unknown, the observation retains `taxStatus: unknown` and cannot be silently compared with an included
  observation.
- When multiple compatible observations exist, the city point estimate is their median. A single compatible
  observation is allowed only with its basis and uncertainty retained; it is not equivalent to a median.
- “Current” means the retrieval/reference date recorded with the observation. Accommodation experiments use
  a dated one-night, two-adult query where the source supports it; deviations are visible and scored by basis.
- `not_found`, `blocked`, `stale`, and `class_absent` are different states. Absence requires positive
  enumerating evidence; failure to find a page is not absence.
- `activities_free = 0` is definitional and requires no price observation.

## Product fields

| Field | Frozen estimand | Direct unit / evidence basis |
| --- | --- | --- |
| `accom_shared_hostel_dorm` | Two separately purchasable dorm beds in an eligible hostel for one night | `per_person_bed_night`; dorm label or equivalent occupancy evidence required. A one-bed observed input may be multiplied by two only in deterministic code |
| `accom_hostel_private_room` | One private hostel room for two travellers for one night | `per_room_night`; private-room occupancy required |
| `accom_1_star` | Standard room for two in an eligible one-star class for one night | `per_room_night`; explicit class evidence required |
| `accom_2_star` | Standard room for two in an eligible two-star class for one night | `per_room_night`; explicit class evidence required |
| `accom_3_star` | Standard room for two in an eligible three-star class for one night | `per_room_night`; explicit class evidence required |
| `accom_4_star` | Standard room for two in an eligible four-star class for one night | `per_room_night`; explicit class evidence required |
| `food_street_food` | Six standard low-cost prepared meals for two travellers over one day | `per_person_meal`; street/takeaway/fast-food definition retained |
| `food_budget` | Four street meals plus two inexpensive-restaurant meals for two over one day | input meal measures and basket formula retained |
| `food_mid_range` | Two street meals, two inexpensive meals, and one mid-range shared meal for two over one day | `per_two_person_meal` for the shared meal |
| `food_high_end` | Two inexpensive meals, one mid-range shared meal, and one premium shared meal for two over one day | premium meal definition and source basis required |
| `drink_coffee` | One regular cappuccino | `per_person_item` |
| `drinks_none` | Two cappuccinos for two travellers; no alcohol | deterministic basket |
| `drinks_light` | Two cappuccinos and two domestic draft beers | deterministic basket |
| `drinks_moderate` | Two cappuccinos, four domestic draft beers, and two standard cocktails | deterministic basket |
| `drinks_heavy` | Two cappuccinos, six domestic draft beers, four standard cocktails, and two wine glasses | deterministic basket |
| `activities_free` | No paid activity spending | definitional zero |
| `activities_budget` | Two adult tickets to a standard low-cost paid attraction | `per_person_ticket` |
| `activities_mid_range` | Two adult places on a half-day group activity | `per_person_activity` or group-equivalent; duration required |
| `activities_high_end` | Two adult places on a full-day premium activity | `per_person_activity` or group-equivalent; duration and premium basis required |

## Model and missingness rules

Derivation may use only named observed inputs and versioned coefficients. A model must not be fitted on
values created by the same model family, asserted constants in the shipping CSV, or incompatible source
bases. A genuinely absent class is not silently filled. If the product ultimately requires a number for an
absent class, that product decision and its modelled semantics must be separately documented and validated.

## Dated collection amendment — 31 July 2026

Experiment 025 confirms that the shared-dorm product estimand remains two beds for two travellers, while the
collection contract may retain an explicit one-adult bed/night observation and apply the fixed factor of two
in deterministic code. This changes the direct input unit, not the product estimand; it introduces no fitted
parameter. Source currency, tax status, retrieval date, and display-currency warnings remain attached to the
one-bed observation. See `data/reference/v5/experiments/025-accommodation-bed-boundary/`.
