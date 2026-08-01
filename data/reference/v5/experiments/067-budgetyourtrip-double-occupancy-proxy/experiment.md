# Experiment 067 - BudgetYourTrip source-level double-occupancy proxy

## Hypothesis

The strict 066 rule may be unnecessarily binary for a statistical source. BudgetYourTrip's broader destination
pages explicitly describe typical double-occupancy hotel prices, while its star-specific pages expose one-star
averages without repeating the occupancy wording. If both pages can be joined for the same city and source, the
star value is a labelled source-defined double-occupancy proxy candidate. It remains unvalidated and is not an
observed product anchor.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve fresh cities: London, Toronto, New York City, Lisbon, Prague, Vienna, Bangkok, Nairobi, Cairo, Auckland,
  Stockholm, and Kuala Lumpur.
- Exactly two searches and two page reads per call: exact-city one-star hotel page, then exact-city destination
  page with the source's typical double-occupancy wording.
- No second search/read, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- A proxy candidate requires both same-source pages, exact city, one-star class, numeric one-night statistic, named
  currency, explicit tax basis, and source-level two-person/double-occupancy wording.

## Pre-registered screening gate

- At least 8/12 complete proxy candidates and at least 10/12 protocol-compliant calls.

A pass authorizes only an independent calibration experiment against explicit-two-adult one-star observations. It
does not authorize mapping, fitting, tax normalization, or treating proxy candidates as observed. A failure closes
this source-level relaxation for the tested source.

## Results

To be filled by the deterministic analyzer. Blocked, not-found, stale, and basis-unresolved states remain distinct.
