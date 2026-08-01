# Experiment 068 - BudgetYourTrip search-snippet occupancy proxy

## Hypothesis

Experiment 067 found that page-read blocking, not only occupancy semantics, prevented joining BudgetYourTrip's
one-star page with its source-level double-occupancy statement. Search snippets may expose both facts with two cheap
operations and fewer 429/timeouts. This is a lower-evidence proxy screen, not a direct source or model validation.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve fresh cities: Madrid, Rome, Paris, Copenhagen, Berlin, Athens, Budapest, Istanbul, Singapore, Mumbai,
  Rio de Janeiro, and Mexico City.
- Exactly two ordered searches per call; no page reads, retries, fallback sources, arithmetic, FX conversion,
  averaging, or cross-city evidence.
- A proxy candidate requires exact-city one-star numeric one-night snippet, named currency, explicit tax basis, and a
  same-source exact-city snippet explicitly stating two people or typical double occupancy.

## Pre-registered screening gate

- At least 8/12 complete snippet proxy candidates and at least 10/12 protocol-compliant calls.

A pass authorizes only a page-backed or independent explicit-two-adult calibration experiment. It does not authorize
mapping, fitting, tax normalization, or presenting snippets as observed product values.

## Results

To be filled by the deterministic analyzer. Snippet-only evidence retains a lower quality flag than page-backed
evidence and cannot silently replace a blocked page.
