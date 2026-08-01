# Experiment 071 - activity per-person adult scaling panel

## Hypothesis

The activity product definitions can use explicit per-person adult prices as direct inputs: deterministic code can
multiply one adult ticket by two for `activities_budget`, and two adult places on a per-person group tour can be
constructed for the half-day and full-day tiers. This is a collection-boundary test, not an accuracy or mapping test.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Lisbon, Hanoi, Copenhagen, Bangkok, Prague, Mexico City, Tokyo, Cape Town, Nairobi, San Francisco,
  New York City, and Sydney.
- Exactly three ordered search-only operations per call: a standard adult attraction ticket, a half-day group tour,
  and a full-day premium activity.
- No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence. The LLM
  reports the one-person source basis; deterministic code owns the fixed factor of two.
- Budget requires an exact-city named attraction, adult per-person ticket, numeric standard non-`from` price, and
  known tax treatment. Mid-range additionally requires an explicit half-day duration (3-6 hours), adult per-person
  or equivalent group-unit price, and group/tour identity. High-end requires an explicit full-day duration (at least
  6 hours), premium/organized activity identity, adult per-person or equivalent group-unit price, and known tax basis.
- Generic entertainment averages, bundles, ranges, child prices, member/sale/from/lowest prices, unknown tax,
  ambiguous duration or party basis, and wrong-city evidence fail closed.

## Pre-registered screening gate

- At least 8/12 strict rows for each activity category.
- At least 6/12 cities complete for all three categories.
- At least 10/12 protocol-compliant calls.

A pass authorizes a separate deterministic-scaling validation with independent two-adult or two-ticket benchmarks. It
does not authorize product mapping or claim that the factor of two is accurate for group tours. The final model/anchor
gate still requires at least 30 definition-compatible matched cities and 10 locked holdout cities.

## Results

The deterministic analyzer found 12/12 protocol-compliant calls, but only 3/12 strict budget-ticket rows, 0/12
half-day group rows, and 1/12 full-day premium rows. No city was complete. Failures were dominated by unknown tax
basis, from/discount prices, missing duration, group-versus-per-person ambiguity, and incomplete party evidence.

The category and complete-city gates failed decisively. **Verdict:** reject this per-person activity source screen at
current reliability. The four accepted source facts remain one-person/per-person property evidence only; no factor-of-
two arithmetic, tier mapping, or accuracy claim follows. A later activity method must use a materially different
source/contract and validate deterministic scaling against definition-compatible two-adult benchmarks.
