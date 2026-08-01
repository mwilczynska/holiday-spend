# Experiment 051 verdict — reject complete minimal-anchor promotion

## Decision

Do not promote the fixed four-search nine-anchor contract as a complete source boundary. It is useful for food,
drink, and paid-attraction inputs, but accommodation and three-star hotel anchors remain the limiting gaps.

## Evidence

- Six independent single-city Luna-class contexts: Lisbon, Copenhagen, Hanoi, Prague, Mexico City, and sparse Don Det.
- Exactly four ordered searches per city: 24 searches total; six current-city page reads; no retries, arithmetic, FX,
  averaging, or cross-city evidence.
- No city returned all nine anchors. Non-sparse coverage ranged from 5/9 (Copenhagen/Prague) to 8/9 (Mexico City);
  no non-sparse city reached the preregistered 80% promotion rule.
- `hotel_3star_room_2p`: **0/6**; hostel dorm 2/6; private hostel 1/6. Food/drink anchors reached 4–5/6 and
  paid attraction 5/6.
- Don Det returned 0/9, confirming sparse-city fallback remains unresolved.

This is source-feasibility evidence, not price accuracy. Deterministic modelling must not hide these missing anchors;
the next method must define and validate the model boundary against independent city-level ground truth.
