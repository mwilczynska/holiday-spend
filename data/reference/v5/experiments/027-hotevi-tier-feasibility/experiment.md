# Experiment 027 — HOTEVI grouped hotel-tier feasibility

Date: 2026-07-31

## Hypothesis

HOTEVI's free city-level monthly table may provide a stable hotel level anchor with grouped 1–2-star,
3-star, and 4–5-star tiers, reducing reliance on blocked or occupancy-incomplete OTA snippets.

## Production-shaped test

Each Luna-class invocation researches exactly one city and issues exactly three searches using the versioned
HOTEVI prompt. This tranche tests Lisbon, Hanoi, and Copenhagen independently. No direct page reads, retries,
fallback sources, arithmetic, FX conversion, or cross-city evidence are allowed.

## Acceptance and limitations

Retain only exact city/tier/month/source rows. Occupancy basis is recorded but not upgraded to two-adult
evidence. A grouped tier cannot be silently mapped to an individual product star class. This is source
feasibility evidence, not ground truth or a production anchor; a follow-up must test grouped-tier calibration
against definition-matched city observations before any use.
