# Verdict — promote to broader one-city source validation

Both separate one-city calls returned all five requested Numbeo food/drink anchors: **10/10 cells** with
explicit city, row label, central value, currency, and canonical Numbeo URL in search-result evidence. No
direct page reads, fallback sources, arithmetic, FX, cross-city facts, or unsupported values appeared.

Against eight retained same-row observations, the median absolute percentage difference was 0.79% and p90
was 7.66%. The dates differ (the snippets identify a June 2026 page while prior observations were captured
13 June or 23 July), so this is a source/extraction audit with visible drift, not the locked final accuracy
holdout. McMeal had no prior retained row in either city.

**Decision:** promote the Numbeo-restricted search-snippet route to broader one-city validation. The direct
Numbeo page route remains rejected after HTTP 503/429 outcomes; search-only retrieval is a distinct method.
Keep the strict rule that a snippet must contain the exact city, row, central value, currency, and URL; never
use a range or relabel a blocked search as `not_found`.

The pilot used ten queries across three search calls with no observed throttling, but this is not yet evidence
of steady-state few-cities-per-week reliability or final citation correctness. Expand across regions/cost
bands and lock a city-level holdout before fitting or publishing any modelled tiers.
