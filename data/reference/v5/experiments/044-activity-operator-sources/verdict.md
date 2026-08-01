# Experiment 044 verdict — reject operator activity-source route

## Decision

Reject the tested GetYourGuide/Viator operator-source route for the frozen activity definitions. Do not map any
result to a product value and do not fit an activity model from this panel.

## Evidence

- Six independent single-city Luna-class contexts: Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York City.
- Exactly three ordered searches per city: GetYourGuide ticket, Viator half-day group, GetYourGuide full-day premium;
  18 searches total.
- No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Strict accepted cells: **0/18** (budget 0/6, mid-range 0/6, high-end 0/6), below the preregistered 3/6-per-measure gate.
- Dominant failures: “From”/lowest prices and variable group pricing. Other failures included wrong product type,
  unknown taxes, incomplete duration, and missing adult or premium/package basis.

The raw city JSON, telemetry, deterministic `results.json`, and `audit.json` preserve exact failure reasons. This
is source-feasibility evidence only; it is not ground truth and cannot support two-person scaling, averaging, or a
modelled activity tier.
