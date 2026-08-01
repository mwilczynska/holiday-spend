# Experiment 061 verdict - reject complete-city gate; retain paired evidence

## Decision

Reject the pre-registered promotion gate. Do not map Expedia rows or fit class ratios. Retain all strict rows as
paired source evidence and run a separately pre-registered 3-star gap panel; a pass there would still require pooled
30-city/10-holdout validation.

## Evidence

- Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered Expedia searches each
  (2-star, 3-star, 4-star; 36 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence were used.
- Strict coverage was **26/36**: 2-star 8/12, 3-star 8/12, and 4-star 10/12. The complete-city count was 5/12,
  below the 6/12 gate.
- All accepted rows explicitly state two-adult nightly base-rate trends and excluded taxes/fees. Missing rows were
  generic all-hotel trends, district-only results, or class-specific evidence absent from the same snippet.

The panel adds five complete matched cities and definition-compatible paired rows, but it is not a promotion or model
fit. The source basis remains tax-excluded and must stay separate from tax-inclusive observations.
