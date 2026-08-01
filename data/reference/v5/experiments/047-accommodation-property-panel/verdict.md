# Experiment 047 verdict — promote private-hostel property panel; reject one-star route

## Decision

Promote the explicit two-adult private-hostel quote route to a broader property-panel/ground-truth collection.
Reject the one-star property route as insufficiently covered. Neither measure may be mapped to a city-wide product
anchor from this experiment.

## Evidence

- Six independent single-city Luna-class contexts: Berlin, Madrid, Paris, Rome, Tokyo, and Mexico City.
- Exactly four ordered searches per city (24 total): Hostelworld private, Booking private, Google Hotels 1-star,
  Hotels.com 1-star.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.
- Strict private-hostel quotes: **3/6** — Metropol Hostel Berlin, Mexico City Hostel, and Turn Table Tokyo. Each has
  explicit two-adult/one-room occupancy, named property, one-night price, and tax/fee treatment.
- Strict one-star quotes: **1/6** — OCICA OSHIAGE TOKYO by R HOTEL. The 3/6 promotion gate fails.

The three private quotes are property-level ground-truth candidates, not city averages. A broader panel must define
property selection and aggregation before fitting or mapping `accom_hostel_private_room`; the 30-city/10-holdout
accuracy gate still applies. One-star source-default or wrong-class rows remain rejected.
