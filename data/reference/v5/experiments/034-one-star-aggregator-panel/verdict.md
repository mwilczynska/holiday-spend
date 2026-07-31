# Experiment 034 — verdict

**Verdict: reject the complete aggregator panel; retain Budget Your Trip as a guarded fallback candidate.**

Ten independent one-city Luna calls covered the pre-registered seven development cities and three locked
holdouts. Every call issued exactly three restricted searches (30 searches and operations total) with no reads,
retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.

Strict coverage was **12/30 (40%)**, or **11/30** after excluding Helsinki's zero-denominator row, with only Tokyo complete. Development coverage was 10/21; locked holdout
coverage was 2/9 (San Francisco one row, Helsinki one row, New York City zero). All 12 rows had source-default or
unknown occupancy, so explicit two-adult coverage was zero. Trip.com and HotelsCombined were sparse; Budget Your
Trip returned a row in 9/10 cities, but Helsinki's table had zero hotels and Nairobi's had one hotel. Tokyo was
the only city with two-source USD agreement (USD94–141, ratio 1.50); no broader agreement estimate is valid.

The full source-agreement route therefore fails the coverage and quality requirements. Retain Budget Your Trip as
a possible fallback/calibration input only with minimum-sample and zero-denominator guards, and do not map it to
`accom_1_star` until explicit occupancy and held-out accuracy gates are met.
