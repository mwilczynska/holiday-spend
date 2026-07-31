# Experiment 026 — verdict

**Verdict: promote the dorm boundary, reject complete accommodation coverage, and pivot the hotel-class
source/model hypothesis.**

Lisbon, Hanoi, and Copenhagen were each run as a separate one-city Luna invocation using the unchanged
Experiment 025 prompt. The tranche issued 18 searches and 18 search operations with no direct reads, retries,
fallbacks, arithmetic, FX, or cross-city evidence. It accepted 5/18 cells: one dorm bed in each city,
Copenhagen 3-star and Copenhagen 4-star. Lisbon and Hanoi had no qualifying hotel class rows; no city was
complete. Private hostel, 1-star, and 2-star remained missing in all three cities.

The repeated dorm boundary is therefore useful and retained. It does not solve the hotel/private-hostel
coverage blocker. Copenhagen's 3-star CHF and 4-star EUR display currencies are source facts, not local-currency
labels, and require deterministic FX provenance review.

This remains retrieval feasibility evidence, not ground truth or model validation. Do not fit ratios from the
five cells. The next experiment should test a separately declared hotel-class occupancy-basis hypothesis or
another public source family; it must not silently reinterpret missing occupancy as two-adult evidence.
