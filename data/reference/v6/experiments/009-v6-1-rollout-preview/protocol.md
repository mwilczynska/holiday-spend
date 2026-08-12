# Experiment 009 — v6.1 operational rollout preview

**Status:** generated, read-only comparison
**Generated:** 2026-08-12
**Purpose:** compare the operational v1 and v6.1 outputs before any new-city activation decision.

## Inputs

- v1 shipping dataset: data/reference/city_costs_app_aud.csv
- v1 CSV SHA-256: 0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8
- v6.1 materializations: data/reference/v6/experiments/008-v6-1-development-fixtures/materialized/
- Cities compared: 25 existing development fixtures

The script makes no provider, web, collection, holdout or CSV-write calls. It does not use ground-truth
scores and is an operational impact comparison only.

## Comparison rule

For every one of the 19 planner tiers, compare the unchanged v1 CSV amount with the v6.1 materialized
amount for the same city. Report the ratio 'v6.1 / v1', signed percentage difference, medians and the
10th/90th-percentile signed-difference tails. A row is explicitly flagged when v6.1 is above 2x v1 or
below 0.5x v1. Zero-valued definitional rows are retained but have no ratio flag.

## Representative baskets

The three deterministic basket profiles are illustrative combinations, not new product tiers:

| Profile | Accommodation | Food | Drinks | Activities |
| --- | --- | --- | --- | --- |
| budget | accom_shared_hostel_dorm | food_budget | drinks_none | activities_budget |
| mid-range | accom_2_star | food_mid_range | drinks_moderate | activities_mid_range |
| high-end | accom_4_star | food_high_end | drinks_heavy | activities_high_end |

Each basket reports category subtotals and the total for v1 and v6.1. The profile definitions are held
fixed so the comparison cannot be tuned to the observed differences.

## Interpretation boundary

This preview describes operational level changes, not accuracy. It does not validate v6.1 against a new
truth source or turn source-backed proxies or modelled presets into independent observations. The owner has
approved a staged 121-city migration, but this preview alone does not satisfy the live canary or owner-review
requirements for cutover. Keep the live CSV unchanged until those steps are complete.
