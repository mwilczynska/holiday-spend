# Experiment 092 — independent drink-menu calibration

**Status:** Complete — reject wine-glass screen; retain cocktail calibration evidence

## Question

How well do Expatistan's source-defined cocktail and red-wine-bottle items correspond to independent public menu
prices for a standard cocktail and a standard glass of red wine?

## Hypothesis

An exact-city, public menu sample of at least three standard items can provide a robust city-level median for a
cocktail and wine glass. Deterministic same-currency comparisons can then screen a simple Expatistan ratio without
claiming that a bottle is a glass.

## Protocol

- Twelve independent GPT-5.6 Luna contexts, one city per context.
- Exactly three ordered searches: a public cocktail menu, a public wine-by-the-glass menu, and a public menu/tax
  confirmation. The model may read only returned public pages, with no login or checkout.
- No retries, fallback searches, arithmetic, FX conversion, cross-city evidence, or model fitting in the response.
- Return raw arrays of at least three compatible prices; deterministic code computes medians. A cocktail sample must
  be standard/classic (not zero-proof, shots, bottle service, or premium reserve). A wine sample must be a standard
  red wine by a stated glass volume (or explicit standard glass), not a tasting pour or bottle price.
- Preserve venue, source URL/title, retrieval/reference date, currency, tax status, and sample evidence. Unknown tax
  remains visible and is not silently normalized.

## Screen gates and verdict

Require at least 10/12 protocol-compliant calls and at least 8/12 strict cocktail and wine-glass medians. A screen
pass authorizes only a held-out calibration study. Any Expatistan ratio must meet the frozen 30-city/10-holdout
accuracy and bias gates before drink product mapping. A bottle-to-glass factor is never inferred from this screen
alone.

## Results

All 12 calls were protocol-compliant. The strict audit accepted 12/12 cocktail medians but only 4/12 wine-glass
medians; most wine menus omitted a qualifying 125–175 ml volume or exposed only nonstandard pours. The wine screen
therefore failed. Ten cocktail rows joined an Expatistan value in the same currency; the median direct-menu/
Expatistan ratio was 0.917, with substantial city dispersion and no held-out accuracy claim.

**Verdict:** reject the wine-glass calibration screen and do not derive a glass from an Expatistan bottle. Retain
the cocktail rows and ratio distribution as calibration evidence only; no drink product mapping is authorized.
