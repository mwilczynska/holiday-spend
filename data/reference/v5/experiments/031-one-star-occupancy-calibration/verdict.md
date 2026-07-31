# Experiment 031 — verdict

**Verdict: reject the tested explicit-occupancy calibration route; retain source-default candidates only as
unresolved evidence.**

Three independent Luna-class one-city calls issued exactly three searches each (Momondo, Skyscanner, Expedia):
Bangkok, San Francisco, and Nairobi. All calls were protocol-compliant: nine searches and nine search
operations, with no reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city
evidence.

Only two of nine strict cells passed, both Momondo source-default-room rows (Nairobi USD243 and San Francisco
USD54). Bangkok's Momondo result did not expose a qualifying 1-star average. Skyscanner and Expedia returned no
exact city-wide 1-star row with an explicit two-adult/one-room basis in any city. Therefore zero rows are
definition-matched calibration observations, no Momondo/explicit ratio can be fitted, and no value is mapped to
`accom_1_star`.

The next experiment must test a different direct one-star measurement source or an independently curated
two-adult property panel. The 30-city/10-holdout gate remains unchanged.
