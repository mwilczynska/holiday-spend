# Experiment 095 — dated hostel inventory panel

**Status:** Pre-registered; collection pending

## Question

Can a fixed one-night date window and public page reads recover current non-`from` Hostelworld or Hostelz prices for
one shared dorm bed and a two-guest private hostel room?

## Hypothesis

The failure of Experiment 074 was caused by an undated, search-only contract rather than universal source
unavailability. A date-qualified inventory query may expose explicit nightly prices and occupancy for enough cities to
justify a larger current hostel panel.

## Protocol

- Twelve independent GPT-5.6 Luna-class contexts, one city per context.
- Stay window is 2026-09-17 to 2026-09-18 (one night).
- Exactly three ordered searches per city: Hostelworld dorm, Hostelworld private room, then Hostelz dorm/private.
- Public reads are limited to pages returned by those searches. No retries, unregistered sources, arithmetic, FX,
  cross-city evidence, or conversion of a multi-night total into a nightly rate.
- A dorm row requires a named exact-city property, one shared-dorm bed, exact dates, explicit nightly numeric price,
  currency, and tax/fee status. A private row additionally requires exactly two guests and a hostel private room.
  `From`, ranges, packages, unknown dates, or unknown tax status fail closed.

## Screen gate and decision rule

Require at least 10/12 protocol-compliant cities, 6/12 strict dorm rows, 6/12 strict private rows, and 4/12 complete
cities. A pass authorizes only a broader current-inventory and independent 30-city/10-holdout validation. No mapping
or model fit follows a screen pass.
