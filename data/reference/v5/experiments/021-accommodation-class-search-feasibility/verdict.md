# Experiment 021 — verdict

**Verdict: reject the complete accommodation route; retain a small set of class-average source candidates for matched validation.**

Six independent one-city Luna calls issued six targeted search queries each. Only 7/36 cells (19.4%) were accepted and no city had all six classes. Copenhagen supplied a 3-star Booking city average; Lisbon supplied 2-, 3-, and 4-star averages from Momondo/KAYAK; San Francisco supplied a Budget Your Trip dorm-bed average plus KAYAK 3- and 4-star averages. Hanoi, Bangkok, and sparse Don Det supplied no qualifying cells. Hostelworld `From` prices, mixed hostel/guesthouse values, missing room basis, generic or wrong-city results, and event-specific prices were rejected.

The six calls issued 36 searches and 17 search operations, with zero direct reads, retries, fallback sources, arithmetic, FX, or cross-city evidence. All seven accepted observations carried exact city/class or occupancy, nightly central value, currency, and source URL evidence. They come from heterogeneous source families and are feasibility observations, not a matched accuracy sample or coefficients.

Retain the KAYAK/Momondo/Booking/Budget Your Trip class-average patterns for a separately curated, definition-matched accommodation panel. Do not infer hostel private rooms, 1-star, or missing classes from these observations, and do not combine source families without explicit basis harmonization. The production accommodation method remains unresolved.
