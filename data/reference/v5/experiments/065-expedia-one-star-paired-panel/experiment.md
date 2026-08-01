# Experiment 065 - Expedia one-star/three-star paired panel

## Hypothesis

Expedia may expose the missing one-star class under the same explicit two-adult, tax-labelled trend contract that
made it the strongest surviving 2-/3-/4-star candidate. If so, a paired one-star/three-star panel can establish a
viable direct one-star input boundary; if not, one-star must remain a separate source or modelling problem.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve fresh cities: Lisbon, Copenhagen, Prague, Vienna, Berlin, Paris, Rome, Madrid, Istanbul, Bangkok, Nairobi,
  and San Francisco.
- Exactly two ordered searches per call: Expedia 1-star, then Expedia 3-star.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, numeric non-from city-class average/trend, explicit two-adult one-room basis,
  reference window, valid currency, and tax status explicitly included or excluded. A 1-star result must name the
  one-star class; a generic budget/economy result is rejected.

## Pre-registered promotion gates

- At least 8/12 strict one-star rows.
- At least 8/12 strict three-star rows.
- At least 6/12 cities complete for both classes.

A pass authorizes only a larger 30-city/10-locked-holdout source-and-basis validation panel. It does not authorize
product mapping, ratio fitting, tax normalization, or treating source-default occupancy as explicit two-adult
occupancy. Any accepted rows with excluded tax remain a separate tax basis.

## Results

To be filled by the deterministic analyzer after the twelve one-city calls. The verdict must distinguish found,
not-found, blocked, stale, and class-ambiguous outcomes and must not convert a missing one-star row into a modelled
product value.
