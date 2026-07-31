# Experiment 000 — Deterministic v4 Baseline Reassessment

**Status:** In progress
**Started:** 31 July 2026
**Hypothesis:** The existing v3/v4 evidence can serve as a useful deterministic baseline for food and
drink structure, but it cannot by itself satisfy v5's complete 19-field coverage or target-model
one-call constraints. The audit should quantify exactly where it is usable and prevent v5 from repeating
proxy calibration or hidden imputation.

## Pre-registered method

1. Re-run the deterministic v4 ratio fit and confirm its report is reproducible.
2. Inventory accepted observations by city, category, measure, and source basis.
3. Join the direct anchor samples to the observation store without treating asserted production CSV
   columns as ground truth.
4. Map each of the 19 product fields to direct, modelled, definitional, or unavailable evidence under
   `data/reference/v5/data-dictionary-v5.md`.
5. Report complete-case city counts, region/band coverage, and unresolved blockers.

## Acceptance / rejection

This experiment is a baseline audit, not a winning-method test. It passes only if its counts are
deterministic and every unsupported conclusion is visibly labelled. It cannot pass the v5 Definition of
Done without target-model calls, complete matched ground truth, and locked held-out evaluation.

## Expected outputs

- `results.json` — machine-readable coverage and provenance report;
- `verdict.md` — findings, retained baseline components, and rejected assumptions;
- reproducible command recorded in `scripts/README.md` and `PLAN.md`.
