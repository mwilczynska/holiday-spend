# Experiment 001 — Expedia production-anchor replication

**Status:** preregistered before collection
**Collection status:** complete; see `verdict.md` and deterministic `results.json`.

## Hypothesis

Running the Expedia 3-star extractor exactly as the v6 production spine runs it will produce a
usable `hotel_3star_room_2p` observation for at least 12 of the 15 development cities already
matched to the Booking.com ground-truth panel. Applying the frozen FX snapshot and the existing
`expediaToBookingMultiplier = 0.9361` will reproduce the Booking v2 medians with median APE at
or below 25% and median signed error within ±15%. This tests the production path and the existing
Booking → Expedia calibration; it does not authorize refitting coefficients or the offset.

## Pre-registered sample and parameters

- Cities: the exact 15 cities listed in `inputs.json`; these are the existing
  `sourceCalibrationOffsets.hotel_3star_room_2p.fit.matchedCities` development matches.
- Source prompt: `docs/prompts/llm_prompt_city_cost_v6_expedia_3star.md`, rendered once per city.
- Reference date: `2026-09-17` (the frozen one-night window is 2026-09-17 to 2026-09-18).
- Requested measure: standard Expedia three-star room, two adults, one night.
- Production constraints: provider web-search snippets only, no direct page reads, no estimation or
  conversion by the extractor, at most four targeted searches per attempt, and at most one retry
  after a reported block. Missingness is retained as `blocked`/`not_found`, never substituted.
- Provider/model: the configured production-path provider and model available at collection time;
  each raw response and telemetry record the actual values.

## Held-out units

None. This is an unsealed development-panel production-path check, not a second holdout. The 15
cities are fixed before collection, and no holdout ledger or holdout score is read.

## Acceptance / promotion gate

Accept the production-anchor replication as measured evidence for the M4 decision only if all of the
following are true:

1. At least 12 of 15 cities have an observed Expedia measure after the allowed retry, with
   `directPageReads = 0` and no city exceeding the production 25-search budget.
2. On the observed pairs, predicted Booking = observed Expedia converted with the frozen FX snapshot
   × `0.9361` has median APE ≤25% and median signed error between −15% and +15%.
3. The failures do not show a batch-level artifact signature: more than 30% of cities blocked,
   systematic class/basis ambiguity, or a source-direction reversal.

If any condition fails, verdict `revise and retest` or `reject` according to the deterministic
results, and do not refit the offset in this experiment. A pass still does not evaluate food,
drink, activity, Gate 4 or Gate 5, and does not justify migrating the 121-city CSV by itself.

## Maximum calls and recorded outputs

- 15 primary extractor calls.
- Maximum 30 provider calls including one block retry per city.
- Maximum 120 targeted searches including retries (4 per attempt × 30 attempts).
- Required outputs: one unedited raw response and one telemetry record per city, deterministic
  `results.json`, and one `verdict.md`.
