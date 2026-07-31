# Experiment 020 — verdict

**Verdict: promote the official low-cost attraction-ticket pattern for broader testing; reject the complete activity-anchor route.**

Six independent one-city Luna calls issued exactly three targeted searches each. Under the strict definitions, 6/18 cells were found (33.3%): Copenhagen and Bangkok each supplied one official adult attraction ticket, Lisbon supplied one official attraction ticket, and Hanoi supplied all three anchors (museum ticket, four-hour group tour, and eight-hour premium organized tour). Lisbon's four-hour EUR41/person tour was retained in the raw result but normalized to `not_found` for the half-day group measure because the public brochure did not explicitly establish shared/group status. San Francisco and sparse Don Det had no qualifying cells. Only Hanoi was complete.

There were 18 queries and 12 search operations, with zero direct reads, retries, fallback sources, arithmetic, FX, or cross-city evidence. Six strict accepted facts carried city/activity identity, adult or per-person basis, duration where required, central value, currency, and source URL. The attractive Hanoi result is a feasibility observation, not a model-fitting sample; one city cannot establish a relationship.

Promote the official attraction-ticket source pattern for a larger city-level activity panel. Keep half-day/full-day activities fail-closed unless duration, adult basis, group/organized status, and non-`from` price are explicit. Do not infer all activity tiers from the Hanoi success or use nearby-city/package evidence. Accommodation, complete food/drink derivation, provider telemetry, and the remaining 19-field methodology gates remain open.
