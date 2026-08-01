# Experiment 084 — Nomadlio food/drink structured-page proxy panel

**Status:** In progress

## Question

Can Nomadlio's predictable city pages supply broad, current food/drink row coverage in one bounded one-city call, and
do the pages define enough unit and party semantics to be product-compatible rather than merely proxy evidence?

## Hypothesis

Nomadlio pages will provide all six requested labels for at least 10/12 cities and 10/12 protocol-compliant calls.
The screen is deliberately split: a row may be source-observed only when the page states its exact unit/party/tax
basis; otherwise it is a source-defined proxy and cannot be mapped or used as definition-matched ground truth.

## Pre-registered protocol

- One independent GPT-5.6 Luna-class context per city.
- Exactly two ordered operations: search the exact Nomadlio city page, then read that exact page.
- No retries, fallback sources, arithmetic, FX conversion, cross-city evidence, or inferred units/party sizes.
- Preserve page display currency (normally USD), last-updated date, exact row labels and values, and whether the page
  explicitly establishes serving/party/tax semantics.
- A screen pass authorizes only a separate semantic and accuracy calibration. It does not authorize substituting
  `wine_bottle` for a wine glass, `coffee` for cappuccino, or any row for street food/premium meal.
