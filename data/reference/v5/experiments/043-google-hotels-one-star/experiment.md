# Experiment 043 — Google Hotels one-star property search

## Hypothesis

Google Hotels search snippets can expose a jointly definition-compatible one-star, two-adult, nightly price
more reliably than the Booking/Hotels.com and registry-join routes tested in Experiments 032, 041, and 042.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities across regions and cost bands: Barcelona, Lisbon, Bangkok, Hanoi, Cape Town, and New York City.
- Exactly three ordered Google-Hotels-restricted searches per call.
- No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Accept only exact-city one-star property quotes with explicit two-adult occupancy and tax treatment.

## Pre-registered verdict rules

- Promote the source to a broader property-panel collection route if at least 3/6 cities have at least one strict
  quote and no systematic identity/class failure.
- Any accepted row remains a property observation; no city-level mapping or correction is fitted.
- A future basket model requires a frozen selection/aggregation rule, at least 30 cities, 10 locked holdouts,
  and independent accuracy gates.
