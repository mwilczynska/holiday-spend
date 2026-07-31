# Verdict — reject as production-ready; promote the one-city test shape

All three independent invocations used exactly one city and passed the six-measure JSON contract. They
returned the same result: Booking 3-star USD 254 and 4-star USD 347 city averages; Hostelworld dorm/private
values were rejected as `From` prices; Booking 1- and 2-star pages were blocked. Source correctness was
audited for all six found facts (two facts in each run), and no arithmetic, FX, tiers, or unsupported facts
were emitted.

The repeatability result is unusually strong but narrow: the two found values and four failure statuses were
identical across three calls. This demonstrates that the one-city prompt shape is reproducible for this
source path, not that it is complete or accurate for all cities.

Against the existing Copenhagen direct-property benchmark, the 4-star city average converts to AUD 496.17
using the frozen 2026-07-22 FX snapshot, while the five-quote direct-property median is AUD 309.28: a
**+60.4% signed/absolute error**. The bases differ (city average versus dated property median), so this is
a warning about source-basis bias rather than a final multi-city accuracy score. It is nevertheless above
the v5 25% error gate and cannot be silently corrected from one city.

**Decision:** reject this candidate as the final accommodation method; retain and promote the single-city
invocation shape for all subsequent target-model tests. Any panel-level experiment must now be an explicit
set of separately recorded one-city calls. Test a source or model that shares the ground-truth basis before
fitting coefficients or integrating the Booking averages.

Telemetry counted three delegated tasks, 18 direct URL attempts, 12 successes, six failures, three page-read
calls, three find calls, and one fallback search call with two queries. Exact provider model ID, parameters,
tokens, latency, and cost were not exposed.
