# Experiment 069 - BudgetYourTrip one-star proxy explicit calibration screen

## Hypothesis

The ten BudgetYourTrip snippet candidates promoted by Experiment 068 may be usable as a cheap collection anchor if
they track independently observed one-star room prices for two adults. This experiment tests paired feasibility only;
it does not treat a named-property quote as a city-level validation target or fit a correction.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: the ten 068 proxy candidates plus Paris and Mumbai, which test proxy-missingness handling.
- Exactly five ordered searches per call: two BudgetYourTrip searches (the 068 proxy pair), then one each for Google
  Hotels, Expedia, and Hotels.com explicit one-star named-property quotes.
- Search only. No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Preserve every candidate and its source. A direct calibration candidate must be an exact-city named property that is
  explicitly one-star, gives a numeric non-`from` nightly room price, explicitly identifies two adults/one room (or
  equivalent), and states tax/fee treatment. A city may have multiple direct candidates; the deterministic analyzer
  records them without choosing or combining them.
- BudgetYourTrip rows remain `proxy_candidate`; they are not direct observations. Direct named-property rows are
  `explicit_two_adult_candidate`, but are not city-level ground truth until a separately declared property-basket
  aggregation is designed.

## Pre-registered screening gate

- At least 6/12 cities have both a complete 068 proxy pair and at least one independent explicit-two-adult one-star
  candidate.
- At least 10/12 calls are protocol-compliant.

A pass authorizes a pre-registered property-basket design and a larger city-level calibration sample. It does not
authorize a coefficient, product mapping, or accuracy claim. The final model gate remains at least 30 definition-
compatible matched cities with at least 10 locked holdout cities.

## Results

The deterministic analyzer found 12/12 protocol-compliant calls and 11/12 BudgetYourTrip proxy candidates, but no
independent explicit-two-adult named-property candidate. There were therefore
**0/12 matched cities**. The
screening gate therefore failed. Google Hotels commonly exposed a 1-star property and a nightly price without
explicit occupancy; Expedia exposed two-adult prices as `from`/starting values or the wrong class; Hotels.com
exposed lowest prices or a different class.

**Verdict:** reject this proxy calibration route at the screening stage. Preserve the eleven 068-style proxy rows and the
rejected direct-source evidence as labelled records, but do not compute a correction, aggregate property quotes, map a
product tier, or fit a model. A future calibration would require a new, explicitly declared city-level property-basket
design with at least 30 matched cities and 10 locked holdout cities.
