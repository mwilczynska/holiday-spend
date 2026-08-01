# Experiment 062 verdict - reject three-star coverage repair

## Decision

Reject the pre-registered coverage-repair gate. Do not amend Experiment 061's gate, map 3-star prices, or fit a
ratio. Retain the four new strict rows as source evidence, but stop this query-retry branch and reassess the pooled
Expedia source/model boundary.

## Evidence

- Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly one ordered Expedia 3-star search each
  (12 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence were used.
- Strict coverage was **4/12** overall: Athens, Ho Chi Minh City, Manila, and Zurich. None of the four Experiment
  061 recovery cities (Cairo, Kuala Lumpur, Mumbai, Santiago) recovered.
- The remaining rows were generic all-hotel trends, district-only results, or lacked an exact city-class trend.
  Accepted rows explicitly state two-adult nightly base-rate trends and excluded taxes/fees.

The route's paired source coverage is too query-sensitive for promotion and still has no 30-city complete-case
sample. No product mapping or model fitting follows this experiment.
