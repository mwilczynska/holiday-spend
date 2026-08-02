# Experiment 090 — one-call multi-source anchor bundle

**Status:** Complete — reject complete-bundle screen

## Question

Can the strongest surviving source contracts be collected in one production-shaped, single-city Luna request so
that deterministic local code has enough labelled anchors to derive the 19 fields?

## Hypothesis

A bounded five-search call can collect definition-labelled food/drink inputs from Numbeo, activity tiers from
BudgetYourTrip, 2–4-star class trends from Expedia, and hostel/one-star candidates without cross-city evidence or
LLM arithmetic. This is an anchor-coverage screen only; it does not authorize the unresolved accommodation mapping,
source-defined proxies, or activity semantic mapping.

## Protocol

- Twelve independent GPT-5.6 Luna contexts, one city per context.
- Exactly five ordered source-restricted searches: Numbeo food/drink, BudgetYourTrip activities, Expedia 2–4-star,
  public hostel dorm/private, and public one-star.
- Search only: no page reads, retries, fallback sources, arithmetic, FX, aggregation, or cross-city evidence.
- Preserve raw source currency, reference period, tax/fee status, units, and evidence basis. A source-defined or
  unknown-occupancy candidate is not silently promoted to an observed product value.
- The analyzer reports source coverage by evidence level and complete anchor bundles. It does not fit coefficients or
  materialize any of the 19 product fields.

## Screen gates and verdict rules

Require at least 10/12 protocol-compliant calls and report complete bundles separately for (a) food/drink inputs,
(b) activity tiers, (c) hotel class inputs, and (d) hostel/one-star inputs. A pass means only that the bundle is
worth a broader end-to-end validation; it does not override the frozen definitions or 30-city/10-holdout model
gate. Any product-compatible value must retain observed/modelled/proxy/imputed provenance.

## Results

All 12 calls were protocol-compliant. The strict audit found five Numbeo food/drink inputs in 8/12 cities, all
three BudgetYourTrip activity proxies in 8/12 cities, four 3-star hotel rows, two 4-star rows, and zero 2-star,
hostel-dorm, private-hostel, one-star, cocktail, or wine-glass rows. No city had a complete food/drink, hotel, or
all-anchor bundle. The protocol gate passed, but the product-coverage objective failed.

**Verdict:** reject this as a complete production anchor bundle. Retain the partial rows with their evidence basis;
do not silently derive missing cocktails, wine, accommodation, or one-star values and do not map the BudgetYourTrip
activity proxies to the frozen activity estimands.
