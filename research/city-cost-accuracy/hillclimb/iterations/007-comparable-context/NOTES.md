# 007 comparable-city context

Three dev comparables' reference prices (same country, else same region; leave-one-out, no test cities) in the
app's EXTRA_CONTEXT slot. Earlier partial run was cut by the usage limit; this is the complete 108/108 run.

- Raw: 0.292 -> 0.2166, accept against the raw baseline (improvement 0.075, CI 0.053-0.099, 40/54 cities).
  Biggest gains: mid-range meal (-0.27 mean |log|), hostels (-0.14).
- Calibrated per region: 0.2258 vs incumbent 0.2074, reject (worse; region factors overfit on top of context).
- Calibrated per anchor: 0.2085 vs 0.2074, reject (no difference).
- Reading: the context removes the same shared bias that calibration removes. It is an alternative to
  calibration, not an addition. Raw context (0.217) is about as good as calibration alone. The hypothesis that it
  would fix city-specific error is not supported.
