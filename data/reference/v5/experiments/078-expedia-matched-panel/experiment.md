# Experiment 078 — Expedia matched 2–4-star panel

**Status:** Complete - reject pooled fitting ceiling

## Question

Can twelve additional independent single-city Luna calls add enough strict, definition-matched
Expedia 2-, 3-, and 4-star city averages to reach the frozen 30-city matched relationship gate when
pooled with experiments 028, 029, 059–063, and 075?

## Hypothesis

The bounded three-search Expedia trend contract will produce enough strict rows to bring both the
2-star↔3-star and 3-star↔4-star pooled matched relationships to at least 30 cities, while retaining
at least 10 protocol-compliant calls. This is a source-panel ceiling test, not a product mapping claim.

## Pre-registered protocol

- One independent GPT-5.6 Luna-class context per city.
- Exactly three ordered Expedia-restricted searches: 2-star, 3-star, 4-star.
- No direct reads, retries, fallback sources, arithmetic, FX conversion, or cross-city evidence.
- Accept only exact-city, exact-class, two-adult, non-`from`, numeric nightly city/class trend rows with
  source URL/title, reference period, currency, and explicit included/excluded tax status.
- Missing or blocked rows remain `not_found` or `blocked`; no proxy rows are fitted.
- Maximum twelve calls. The pooled gate is 30 matched cities for each relationship and at least 10
  protocol-compliant new calls. If the gate fails, reject pooled fitting and retain rows as source evidence only.

## Ground-truth boundary

The panel is not ground truth for the final product. It is eligible for a later relationship fit only if
the pooled rows pass the city-level complete-case and locked-holdout requirements. No coefficients are
fit in this experiment.

## Results

All twelve calls were protocol-compliant and produced eight strict new rows: Accra 2-star; Addis Ababa
3- and 4-star; Fukuoka 3-star; Krakow 3- and 4-star; and Valencia 3- and 4-star. The remaining rows were
truthfully rejected because Expedia exposed generic or class-ambiguous trends, unnamed currencies, country or
regional results, or no qualifying result.

After deterministic de-duplication and pooling with experiments 028, 029, 059-063, and 075, the panel contains
89 strict rows across 41 cities. The matched relationships are 20 cities for 2-star from 3-star and 26 cities
for 4-star from 3-star. The pre-registered 30-city gate therefore fails for both relationships. No coefficient,
class split, or product mapping is produced.
