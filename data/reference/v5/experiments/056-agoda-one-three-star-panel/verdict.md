# Experiment 056 verdict - reject Agoda one-/three-star route

## Decision

Reject the Agoda source route under the strict contract. Do not map one- or three-star prices, treat maximum
occupancy as a selected one-room quote, or fit a class ratio from these results.

## Evidence

- Twelve independent single-city Luna-class contexts issued exactly two ordered searches each (Agoda 1-star then
  3-star; 24 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict coverage was **0/24**: one-star 0/12 and three-star 0/12; no city was complete.
- Agoda commonly returned named properties or maximum-occupancy information, but the search evidence required
  entering dates and did not expose a selected numeric nightly price, explicit one-room basis, and tax treatment.

The route does not provide definition-compatible source facts in the one-call search shape. No product mapping or
model fitting follows this experiment.
