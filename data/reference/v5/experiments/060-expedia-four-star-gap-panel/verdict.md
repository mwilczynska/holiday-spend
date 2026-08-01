# Experiment 060 verdict - reject coverage-repair gate; retain Expedia candidate

## Decision

Reject the pre-registered coverage-repair gate. Do not amend Experiment 059's gate, map 4-star prices, or fit a
ratio. Retain the recovered rows as source-feasibility evidence and continue a new-city paired 2-/3-/4-star panel.

## Evidence

- Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly one ordered Expedia 4-star search each
  (12 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence were used.
- Strict coverage was **9/12** overall. Three of the five prior Experiment 059 misses recovered: Budapest, Sydney,
  and Tokyo. Buenos Aires, Cape Town, and Warsaw had no qualifying exact-city class trend; the first two remained
  generic all-hotel results and Warsaw returned generic or single-property evidence.
- Every accepted row explicitly stated a two-adult nightly base-rate trend and excluded taxes/fees.

The overall source signal is strong, but the pre-registered recovery threshold was 4/5 and only 3/5 passed. Combined
with Experiment 059 this yields 16 unique strict 4-star cities, still below the 30-city modelling requirement. No
product mapping or fitting follows this experiment.
