# Experiment 032 — explicit one-star property basket

Date: 2026-07-31

## Hypothesis

When city-wide one-star averages and occupancy metadata are unavailable, a small basket of named one-star
properties with explicit two-adult/one-room prices may be collectable in the single-city production call. If
retrieval is repeatable, the basket statistic can be evaluated later against definition-matched ground truth.

## Production-shaped test

Each Luna-class invocation researches exactly one city and issues exactly four bounded source searches:
Booking.com, Hotels.com, Trip.com, and Agoda. There are no page reads, retries, fallback sources, arithmetic, FX
conversion, averaging, or cross-city evidence. This tranche tests Barcelona, Prague, and Nairobi independently.

## Acceptance and stop rules

Accept only named 1-star property quotes with explicit two-adult/one-room occupancy, a numeric non-`from` nightly
price, currency, exact city, class, date/window, and source provenance. Count qualifying properties and cities; do
not treat any basket as an observed city-level `accom_1_star` value. Reject the route if snippets provide no
explicit occupancy or if property identity/class cannot be verified. A later basket model would still require a
30-city/10-holdout validation panel.
