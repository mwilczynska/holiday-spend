# Experiment 074 - Hostelworld current shared-dorm anchor panel

## Hypothesis

Public Hostelworld search results can provide a current, production-feasible shared-dorm anchor for one person when
the result names the exact city and property, states a numeric non-`from` nightly bed price, and exposes occupancy,
currency, tax/fee basis, and dates. A strict single-search screen will reveal whether this source is a viable current
replacement for the stale Price of Travel index.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Bangkok, Lisbon, London, Paris, Rome, Prague, Tokyo, Hanoi, New York City, Sydney, Cape Town,
  and Mexico City.
- Exactly one ordered search operation per call, targeted to public Hostelworld results for a shared dorm bed.
- No page reads, second searches, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city
  evidence.
- Accept only a named property in the exact city, one-person shared-dorm bed, numeric standard non-`from` nightly
  price, named currency, explicit tax/fee basis, and visible stay/reference dates. A sale, limited-time deal, package,
  multi-night total, private room, per-room amount, occupancy-unknown result, or missing tax basis fails closed.
- Luna reports the source fact only. Deterministic code owns any later two-person scaling and currency conversion; this
  experiment performs neither.

## Pre-registered screening gate

- At least 8/12 strict current shared-dorm rows.
- At least 10/12 protocol-compliant calls.

A pass authorizes a larger source panel and independent 30-city/10-holdout accuracy validation. It does not authorize
mapping or fitting. A fail rejects this exact source/query boundary, while retaining any strict rows as property-level
evidence only.

## Results

All twelve calls were protocol-compliant, but zero strict current shared-dorm rows were returned. Hostelworld exposed
`From`/city-list prices, seasonal ranges, or named listings without the required dates and tax/fee basis. No value was
recovered from a range endpoint or inferred from a listing.

**Verdict:** reject this one-search Hostelworld boundary at the source screen (0/12 versus the 8/12 gate). Retain the
not-found reasons and any URLs as access evidence only; do not map, scale, or fit a dorm value. A future attempt would
need a materially different source and a new pre-registered contract.
