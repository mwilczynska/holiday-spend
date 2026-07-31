# Experiment 030 — verdict

**Verdict: retain Momondo 1-star rows as calibration candidates; reject them as product observations until
occupancy is calibrated.**

Bangkok, San Francisco, and Nairobi each received one compliant two-search invocation (six searches and six
search operations; no reads, retries, fallback, arithmetic, FX, or cross-city evidence). Momondo returned one
1-star candidate in every city; KAYAK returned no exact city-wide 1-star row. Coverage was 3/6 candidate cells,
but zero had explicit two-adult occupancy: Bangkok was `unknown`, while Nairobi and San Francisco were
`source_default_room`.

The candidates preserve city/class/numeric/source/date provenance, but source-default or unknown occupancy is
not equivalent to the frozen two-adult estimand. Do not map these rows to `accom_1_star`, fit a correction from
three cities, or infer occupancy from the search query. Retain Momondo only for a separately designed
definition-matched occupancy calibration panel; the Expedia 2–4-star route remains the production candidate.
