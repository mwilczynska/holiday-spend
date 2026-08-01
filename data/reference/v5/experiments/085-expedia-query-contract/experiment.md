# Experiment 085 — Expedia exact-heading query contract

**Status:** Complete — reject pooled fitting ceiling

## Question

Can a materially different Expedia search contract—anchored to the exact indexed heading
`Price trends for properties with N Stars`—recover enough strict 2-, 3-, and 4-star city rows to
close the pooled 30-city matched relationship gates? Experiments 075 and 078 used broad natural-language
queries and stopped at 20 matched 2↔3 cities and 26 matched 3↔4 cities.

## Hypothesis

Search-result ranking is the current bottleneck rather than the Expedia source itself. Quoting the exact
class-heading phrase and the source's own two-adult/tax wording will expose more class-specific trend pages,
particularly for the missing class in cities that already have another class. The strict estimand and
acceptance rules are unchanged.

## Pre-registered protocol

- Twelve independent GPT-5.6 Luna-class contexts, one city per context.
- Exactly three ordered Expedia-restricted searches, one for each class. The query must use the exact
  class-heading phrase (`Price trends for properties with 2 Stars`, then 3 and 4) plus `2 adults` and
  `taxes and fees`.
- Search only. No page reads, retries, fallback sources, arithmetic, FX conversion, aggregation, or
  cross-city evidence.
- Accept only an exact-city, exact-class, numeric non-`from` nightly city/class trend with named currency,
  reference window, explicit two-adult basis, and explicit tax treatment. `$` without a named currency is
  not enough. Unknown or blocked rows remain `not_found`/`blocked`.
- A qualifying row remains source evidence only. No coefficient, mapping, or product value is produced.
- Maximum twelve calls. Promotion requires the pooled deterministic audit to reach at least 30 matched
  cities for both 2-star←3-star and 4-star←3-star, with at least 10 compliant new calls. Otherwise reject
  the pooled fitting ceiling and retain rows without mapping.

## Ground-truth boundary

These Expedia trends are not independent ground truth for the final product. They become eligible for a
relationship fit only if the pooled complete-case rows satisfy the frozen city-level development/validation/
holdout contract. No fitting occurs in this experiment.

## Result

The twelve calls were protocol-compliant but produced zero strict rows. The exact-heading query did not recover
the missing Expedia classes: results were commonly generic/district/wrong-city or displayed a bare `$` without a
named currency. The pooled audit therefore remains below both 30-city matched gates; see `verdict.md`.
