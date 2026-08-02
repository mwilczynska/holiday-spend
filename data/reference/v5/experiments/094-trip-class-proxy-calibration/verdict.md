# Experiment 094 verdict

**Verdict: reject Trip.com class proxy calibration.**

The one-city Luna shape was feasible: 12/12 calls obeyed the three ordered
searches, and 36/36 rows were exact-city/class weekday averages with explicit
`source_defined_proxy` labels. That is source coverage, not product accuracy.

The deterministic join to existing explicit-two-adult, tax-excluded Expedia
trends produced only 12 same-currency pairs (below the registered 15). Median
absolute error was 124.2%, p90 absolute error 532.4%, and median signed error
+124.2%. Values varied by viewer currency and Trip.com pages sometimes
disagreed with returned snippets after a page read.

Unknown occupancy and tax are therefore materially consequential. Preserve the
raw rows as labelled proxy/negative evidence, but do not relax the frozen
estimand, fit a correction, map any accommodation tier, or present a proxy as
an observed two-person price. The v5 Definition of Done remains unmet.
