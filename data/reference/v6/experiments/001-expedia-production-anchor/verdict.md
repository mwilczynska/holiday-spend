# Verdict: accept

The 15-city production-anchor replication is accepted as measured development evidence. All 15 cities
returned observed Expedia 3-star values in 15 provider calls and 52 targeted searches. No response reported
a block, and every response reported zero direct page reads.

Using the frozen USD→AUD snapshot and the existing `expediaToBookingMultiplier = 0.9361` produced:

| Metric | Result | Pre-registered bound |
| --- | ---: | ---: |
| Observed cities | 15 / 15 | ≥12 |
| Median APE | 8.36% | ≤25% |
| Median signed error | +7.08% | −15% to +15% |
| P90 APE | 44.70% | diagnostic |
| Maximum APE | 61.37% | diagnostic |

This validates the production-shaped Expedia extractor plus the existing Booking → Expedia calibration
on the unsealed development panel. It does not refit the offset or any ladder coefficient, does not read
the spent holdout, and does not evaluate food, drink, activities, Gate 4 or Gate 5. The first-page Booking
panel remains a ratio/source-calibration panel rather than an absolute-level benchmark.

The late duplicate Cape Town `not_found` response is retained as
`cape-town-duplicate-discarded.json` and excluded by fixed invocation order; it was not selected by its
result. Delegated token counts and wall-clock latency were unavailable and remain null in telemetry.
