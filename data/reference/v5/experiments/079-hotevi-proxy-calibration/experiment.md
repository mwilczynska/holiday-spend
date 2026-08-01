# Experiment 079 — HOTEVI grouped proxy calibration panel

**Status:** Complete - reject proxy calibration

## Question

Can HOTEVI's public grouped hotel-rate rows provide a sufficiently broad, repeatable proxy input that can be
calibrated against independent explicit two-adult Expedia class-trend observations for 3-star and 4-star hotel
levels?

## Hypothesis

The grouped HOTEVI table will return all three labelled proxy rows for the 18 new cities. When combined with the
12 development rows from Experiment 076, at least 30 cities will match the pooled Expedia 3-star and 4-star rows,
including ten locked holdout cities per relationship. If so, fit only simple penalized proxy-to-target models and
score them on the locked city holdout. If not, reject the proxy calibration route without fitting.

## Pre-registered protocol

- One independent GPT-5.6 Luna-class context per new city.
- Exactly one HOTEVI-restricted search and one exact-page read.
- No retries, second searches, fallback sources, arithmetic, FX conversion, class splitting, or cross-city evidence.
- Accept only exact-city grouped budget/mid/luxury values with source-defined standard-room semantics; preserve
  unknown occupancy/tax rather than upgrading the rows to observed product anchors.
- Development rows are the 12 retained Experiment 076 records. The ten named new cities are locked holdout rows;
  the remaining eight new cities are validation rows. A city cannot appear in more than one partition.
- The 30-city matched relationship and 10-city locked-holdout gates are mandatory. No production mapping follows
  a coverage-only pass.

## Results

All 18 new calls were protocol-compliant and all 18 produced complete grouped proxy rows. When combined with the
12 development rows from Experiment 076, only 19 cities matched an explicit Expedia 3-star row and 15 matched an
explicit Expedia 4-star row. The locked holdout contributed eight 3-star and five 4-star matches, below both the
30-city relationship and ten-city holdout requirements.

The descriptive, unfitted proxy screen was also poor: 3-star proxy versus Expedia had median absolute percentage
error 17.65% and p90 109.68% overall (holdout median 23.46%, p90 197.30%); 4-star had median absolute percentage
error 35.92% and p90 183.02% overall (holdout median 56.46%, p90 431.91%). These are diagnostics only, not a fitted
model or product accuracy claim. No coefficients, grouped-class split, or product mapping was produced.
