# Experiment 059 verdict - near-pass; retain Expedia as a validation candidate

## Decision

Do not promote the Expedia route to product mapping or model fitting yet. Retain it as the strongest accommodation
source candidate and run a separately pre-registered 4-star gap panel. The pre-registered gate failed only because
4-star coverage was 7/12 rather than 8/12; this is not permission to change the gate retrospectively.

## Evidence

- Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered Expedia searches each
  (2-star, 3-star, 4-star; 36 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence were used.
- Strict coverage was **27/36**: 2-star 9/12, 3-star 11/12, and 4-star 7/12. Six cities were complete, satisfying
  the complete-city sub-gate, but the 4-star class gate failed.
- All accepted rows explicitly state a two-adult nightly base-rate trend and that taxes/fees are excluded. Unknown
  tax treatment, generic city trends, district substitutions, and missing class-specific trends were rejected.

The source basis is promising and internally coherent, but it is a tax-excluded trend rather than an all-in quote.
Keep `taxStatus: excluded` distinct from included observations; do not gross up, combine bases, map tiers, or fit
ratios until the complete source/basis validation and locked holdout gates pass.
