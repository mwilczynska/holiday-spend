# Experiment 034 — one-star aggregator panel

Date: 2026-07-31

## Hypothesis

The aggregator route promoted by Experiment 033 will retain useful exact city/class coverage across cost bands
and regions, and at least two sources will agree closely enough to support a later source-selection/calibration
study. Occupancy remains an explicit evidence field and is not upgraded.

## Pre-registered panel

Development cities: Copenhagen, Prague, Bangkok, Mexico City, Tokyo, Cape Town, Nairobi. Locked city-level
holdouts: San Francisco, Helsinki, New York. Each city is a separate Luna-class invocation with exactly three
restricted searches (Trip.com, HotelsCombined, Budget Your Trip). No reads, retries, fallback sources,
arithmetic, FX conversion, averaging, or cross-city evidence.

## Acceptance

The deterministic audit counts exact city/class/date-aware rows, explicit occupancy separately, complete cities,
source agreement after local normalization, and quality warnings. This is retrieval/source-agreement evidence only:
no `accom_1_star` value or ratio is fitted. A later model remains subject to definition-matched 30-city/10-holdout
accuracy gates, including the locked ten-city holdout requirement.
