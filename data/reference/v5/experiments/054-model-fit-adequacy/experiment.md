# Experiment 054 - model-fit adequacy audit

## Hypothesis

The existing accepted direct observation ledger may contain enough definition-compatible city pairs to fit a
simple model for a missing tier (for example, one-star from three-star accommodation or higher activity tiers
from a lower anchor) without using the shipping CSV or values created by the same formula.

## Protocol

- Read only `data/reference/observations/*.jsonl`.
- Include rows with `reviewerStatus=accepted`, `valueStatus=direct`, finite positive values, and the declared
  source unit. Group by city; repeated rows in one city do not create additional independent cities.
- Count complete city pairs for pre-registered candidate relationships. No coefficients are fitted and no product
  values are generated.
- Require at least 30 matched cities and 10 locked holdout cities before a relationship can enter model fitting.
- Exclude the shipping CSV, asserted constants, modelled rows, source-feasibility-only experiment snippets, and
  any proxy or incompatible definition.

## Pre-registered candidate relationships

- `hotel_1star_room_2p <- hotel_3star_room_2p`
- `hotel_2star_room_2p <- hotel_3star_room_2p`
- `hotel_4star_room_2p <- hotel_3star_room_2p`
- `hostel_private_room_2p <- hostel_dorm_bed_1p`
- `half_day_group_activity_adult_1 <- paid_attraction_adult_1`
- `full_day_premium_activity_adult_1 <- paid_attraction_adult_1`

## Decision rule

If no relationship has 30 complete matched cities, reject the model-fitting hypothesis and do not fit or tune
any relationship. A positive result would authorize a separate pre-registered fit/holdout experiment only.

## Results

The ledger contained 176 accepted direct rows. No accommodation relationship reached even one matched city:
the canonical ledger has one 4-star city and no directly observed 1-star, 2-star, or 3-star class rows, and no
hostel private/dorm pair. The half-day-from-attraction and full-day-from-attraction relations each had only one
matched city (Vancouver). All six relationships failed the 30-city/10-holdout gate.

**Verdict:** reject model fitting. No coefficient or modelled product value was produced.
