# Experiment 041 — verdict

**Verdict: reject the paired occupancy-calibration route; retain BudgetYourTrip city statistics only as guarded
source evidence.**

Six independent one-city Luna calls issued exactly three ordered searches each (BudgetYourTrip, Booking.com,
Hotels.com). All 18 searches were protocol-compliant with no reads, retries, fallback sources, arithmetic, FX
conversion, averaging, or cross-city evidence.

Five cities returned an exact-city BudgetYourTrip one-star statistic; New York City exposed a zero-hotels outcome.
No city returned a qualifying explicit two-adult one-star property quote, so the paired count was **0/6**. Tokyo's
statistic came from a testing-subdomain result and Rome exposed conflicting page families; both retain provenance
warnings and are not treated as equivalent observations.

The pre-registered 3/6 pairing threshold failed. Do not fit an occupancy correction, map a source-default row to
`accom_1_star`, or average conflicting page families. A future one-star method needs independently curated
definition-matched ground truth or an explicitly validated imputation model.
