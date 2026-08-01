# Experiment 045 verdict — reject Trip.com activity-definition route

## Decision

Reject Trip.com as a production source route for the frozen activity definitions. Do not map any result to a
product value and do not fit an activity model from this panel.

## Evidence

- Six independent single-city Luna-class contexts: Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York City.
- Exactly three ordered Trip.com-restricted searches per city: 18 searches total.
- No page reads, retries, fallback sources, arithmetic, FX conversion, aggregation, or cross-city evidence.
- Strict accepted cells: **0/18** (budget 0/6, mid-range 0/6, high-end 0/6), below the preregistered 3/6-per-measure promotion gate.
- Dominant failure: Trip.com exposed “From”/lowest prices. Other failures included unknown taxes, incompatible or
  ranged durations, and missing explicit adult/party or premium basis.

The raw city JSON, telemetry, deterministic `results.json`, and `audit.json` preserve the exact failure reasons.
This is source-feasibility evidence only; it is not ground truth and cannot support two-person scaling, city
averaging, or a modelled activity tier.
