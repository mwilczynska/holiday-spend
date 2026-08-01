# Experiment 057 verdict - reject Booking class-average tax route

## Decision

Reject the Booking class-average route under the strict contract. Do not map 3- or 4-star prices, infer tax
treatment from a class page, or fit a class ratio from these results.

## Evidence

- Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly two ordered searches each (Booking
  3-star then 4-star; 24 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence were
  used. The one-city production shape was preserved.
- Strict coverage was **0/24**: 3-star 0/12 and 4-star 0/12; no city was complete.
- Several pages exposed an exact class, a current numeric average, and sometimes a two-adult/one-room selector,
  but the same evidence did not state whether tax or fees were included. Other results lacked a class average,
  had the wrong city/class, or lacked same-evidence occupancy.

Booking class pages therefore do not supply definition-compatible, tax-resolved source facts in the one-call
shape. No product mapping or model fitting follows this experiment. Retain the raw rows as negative evidence and
move to a materially different source or an explicitly pre-registered tax/estimand experiment.
