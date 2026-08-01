# Verdict — Experiment 073

**Decision: reject the candidate calibration boundary.**

The one-city-per-context protocol itself worked: all 12 calls used exactly one Price of Travel search, one exact
page read, and one current exact-property search, with no retries, fallback sources, arithmetic, FX conversion, or
cross-city evidence. However, the source pair was not calibratable under the pre-registered strict contract:

| Measure | Result | Gate |
| --- | ---: | ---: |
| Protocol-compliant calls | 12/12 | ≥10/12 — pass |
| Strict index rows | 12/12 | informational |
| Strict current benchmark rows | 5/12 | informational |
| Exact-property joins | 4/12 | informational |
| Same-currency matched pairs | 1/12 | ≥8/12 — **fail** |

The single scored pair (Lisbon) has a 38.76% absolute percentage error. Four otherwise strict current quotes were in
CNY against USD index values; converting them was explicitly outside this experiment. Seven cities had no strict
current benchmark, and Paris's property spelling did not meet exact identity. These are coverage and comparability
failures, not evidence that an FX conversion or correction factor would work.

No two-person scaling, currency conversion, correction factor, product mapping, or model fitting is authorized. The
next highest-value experiment is a separate deterministic-FX audit over these retained, definition-compatible rows;
it must be pre-registered and cannot relax property, occupancy, tax, or source-basis requirements after seeing these
results.
