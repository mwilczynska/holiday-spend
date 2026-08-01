# Experiment 064 - Expedia pooled evidence ceiling audit

## Hypothesis

The surviving Expedia class-trend observations may already provide enough definition-compatible, tax-basis-consistent
city pairs for a simple class model, even though individual 12-city panels did not pass their source-feasibility
gates. This deterministic audit measures the pooled ceiling without fitting coefficients.

## Inputs and rules

- Read only accepted exact-city Expedia class rows from Experiments 028, 029, 059, 060, 061, and 063.
- Normalize legacy 028/029 rows only when their evidence explicitly states two-adult nightly trend/base-rate and
  excludes taxes/fees; retain their legacy provenance.
- Prefer the newer v5 strict row when the same city/class appears more than once; do not average or fit.
- Keep tax basis explicit. Included and excluded bases are never combined; unknown tax is ineligible.
- Count city-level complete cases, not rows. A relationship is fit-eligible only with at least 30 matched cities and
  10 locked holdouts; this experiment does not fit any model.

## Decision rule

If any material relationship reaches the 30-city/10-holdout gate, pre-register a separate city-level fit and locked
holdout evaluation. Otherwise, stop claiming that the current Expedia evidence supports a model and identify the
smallest missing data boundary.

## Results

The pooled audit found **80 accepted rows across 36 unique cities**, all explicitly tax-excluded. Class rows were
1-star 0, 2-star 23, 3-star 30, and 4-star 27; 16 cities were complete for 2-/3-/4-star. Matched city counts were
20 for 2-star-from-3-star and 22 for 4-star-from-3-star; hostel/private and one-star relationships had zero rows.
No relationship reached 30 matched cities plus ten locked holdouts. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** reject fitting from the current Expedia pool and pivot the missing-class data boundary.
