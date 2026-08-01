# Verdict — Experiment 074

**Decision: reject the current Hostelworld search boundary.**

| Measure | Result | Gate |
| --- | ---: | ---: |
| Protocol-compliant calls | 12/12 | ≥10/12 — pass |
| Strict shared-dorm rows | 0/12 | ≥8/12 — **fail** |

The one-search Luna contexts consistently exposed `From` prices, seasonal ranges, city-list summaries, or listings
without visible dates and tax/fee treatment. Those results are not definition-compatible observations. No scaling,
FX conversion, fallback source, arithmetic, or product mapping was performed.

This closes the exact Hostelworld city-search boundary for now. The next accommodation experiment should target the
nearest viable modelling evidence (pooled Expedia class rows) or a materially different current source; it must not
relax the frozen occupancy, tax, or non-`from` requirements after observing this failure.
