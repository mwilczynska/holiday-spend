# Experiment 068 verdict - snippet proxy screen passes, calibration still required

## Decision

Promote the BudgetYourTrip snippet route only to the next calibration stage. Twelve independent single-city Luna
contexts issued exactly two ordered searches each, with zero page reads, retries, fallbacks, arithmetic, FX, or
cross-city evidence. All twelve calls were protocol-compliant. Ten cities produced a complete same-source proxy
candidate; Paris lacked explicit occupancy wording and Mumbai lacked an exact-city one-star value.

The 10/12 candidate rate passes the pre-registered screening gate. This does **not** authorize product mapping,
ratio fitting, tax normalization, or treating snippets as observed prices. Every candidate remains a lower-evidence
`proxy_candidate`. The next experiment must compare these proxies against independent explicit-two-adult one-star
observations (or a separately justified page-backed calibration panel), with city-level holdout gates. If calibration
fails, close the route despite its good snippet coverage.
