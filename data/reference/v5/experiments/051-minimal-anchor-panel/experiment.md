# Experiment 051 — one-city minimal anchor panel

## Hypothesis

The nine-anchor extraction shape remains feasible when tested as independent one-city calls with a fixed four-
search budget, including sparse-city behaviour, and can provide a clean boundary for deterministic modelling.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities: Lisbon, Copenhagen, Hanoi, Prague, Mexico City, and Don Det.
- Exactly four ordered searches per call: Numbeo food/drink, hostel, three-star hotel, attraction.
- No retries, other-city evidence, arithmetic, FX conversion, or tier emission; page reads only for returned current-
  city results.

## Pre-registered verdict rules

- Report per-anchor and complete-city coverage, sparse-city coverage, schema/provenance compliance, and telemetry.
- Promote only to model-boundary validation if at least 80% of anchors are strict in four non-sparse cities and
  every gap is explicitly classified. This is not an accuracy or final methodology acceptance test.

## Results

No city returned all nine anchors. Non-sparse coverage ranged from 5/9 to 8/9; no non-sparse city reached the
80%-of-anchors promotion rule. Across six cities, food/drink anchors reached 4–5/6 and paid attractions 5/6, while
three-star hotel coverage was 0/6, dorm 2/6, and private hostel 1/6. Don Det returned 0/9.

**Verdict:** reject promotion as a complete source boundary. Retain the food/drink and attraction source patterns,
but resolve accommodation, hotel-class, and sparse-city gaps before fitting or mapping product tiers.
