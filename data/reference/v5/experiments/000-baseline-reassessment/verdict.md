# Experiment 000 Verdict — Baseline Rejected as a Complete Method

**Completed:** 31 July 2026
**Verdict:** `retain-as-baseline; reject-as-production-method`

The audit is deterministic: 176 accepted observation rows were found with no duplicate observation IDs,
and the generated report reproduced byte-identically on a second run. The evidence covers 99 cities across
all nine project regions.

## What the baseline can support

- `inexpensive_restaurant_meal_1p`: 99 cities
- `midrange_restaurant_meal_2p`: 97 cities
- `mcmeal_combo`: 68 cities
- `domestic_draft_beer_1`: 97 cities
- `cappuccino_1`: 97 cities
- paid attraction: 29 cities
- half-day activity: 3 cities
- full-day activity: 2 cities
- direct 4-star accommodation: 1 city (Copenhagen)

Under the v4 proxy partition, food coverage reaches 68 cities for the street/budget/mid-range path and
97 for the high-end path; drinks reach 97 through coffee/beer inputs. These are proxy-input counts, not
validation of the shipped target measures.

## Why it cannot win v5

1. There are zero direct dorm, private-hostel, 1-star, 2-star, or 3-star hotel observations.
2. Only Copenhagen has a direct 4-star observation.
3. Activities mid-range and high-end have only three and two direct cities respectively.
4. Street food, premium meals, cocktails, and wine are not present at the density required to calibrate
   their proposed v4 proxy coefficients.
5. The v4 ratio fit uses proxy targets and the shipping CSV contains asserted/derived values; neither is
   independent ground truth for the v5 product fields.
6. The original baseline audit did not include a target-model call. Provider credentials are not required
   for subsequent prompt-feasibility work because a delegated GPT-5.6 Luna-class sub-agent can execute the
   prompt; exact production-provider telemetry and the locked holdout remain separate gates.

## Consequence

Retain the v4 source and provenance artifacts as reusable evidence. Do not call the proxy-input counts
complete product coverage and do not use this report as final validation. The next highest-value experiment
is target-class prompt testing plus independent accommodation/activity ground-truth collection. The
target-class test does not require a provider API key.
