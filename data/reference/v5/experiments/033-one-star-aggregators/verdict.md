# Experiment 033 — verdict

**Verdict: promote Trip.com, HotelsCombined, and Budget Your Trip as one-star calibration candidates; reject
product mapping.**

Lisbon, Barcelona, and Hanoi each received one compliant single-city Luna call with exactly three searches.
Eight of nine strict source cells passed: all three sources for Barcelona and Lisbon, and Trip.com plus Budget
Your Trip for Hanoi. No call used reads, retries, fallback sources, arithmetic, FX conversion, averaging, or
cross-city evidence.

The route is materially better for retrieval than the booking-source cascade, but none of the eight rows states
explicit two-adult/one-room occupancy. Cross-source levels also diverge: Lisbon ranges from USD101 to USD207 and
Hanoi from USD24 to USD53. Barcelona's Budget Your Trip row reports zero hotels and is a quality warning. These
are source facts with `source_default_room` or `unknown` basis, not observed product values.

Retain the sources for a broader, pre-registered calibration panel and source-agreement test. Do not map them to
`accom_1_star`, fit a correction, or call one-star coverage complete until occupancy and held-out city-level
accuracy are demonstrated.
