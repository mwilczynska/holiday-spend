# Experiment 030 — one-star source cascade

Date: 2026-07-31

## Hypothesis

Momondo or KAYAK city/class average snippets may provide 1-star candidate rows after Expedia consistently
failed to find a 1-star trend. Occupancy basis will be recorded rather than inferred.

## Production-shaped test

Each Luna-class invocation researches exactly one city and issues exactly two searches: one Momondo and one
KAYAK. This tranche repeats Bangkok, San Francisco, and Nairobi independently. No direct reads, retries,
arithmetic, FX, or cross-city evidence are allowed.

## Acceptance

Retain exact city/class/date/source/numeric rows, but keep `source_default_room` and `unknown` occupancy
separate from explicit two-adult rows. Do not fit or map a candidate to the product until a definition-matched
calibration panel passes the 30-city/10-holdout gate.

This tranche produced source-default/unknown occupancy only; no row is promoted to the product estimand.
