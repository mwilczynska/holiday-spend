# Experiment 065 verdict - Expedia one-star class unavailable under the frozen contract

## Decision

Reject promotion of the Expedia one-star route. The twelve single-city Luna contexts produced **0/12 strict
one-star rows**, **9/12 strict three-star rows**, and **zero complete paired cities**. The one-star search results
were generic all-hotel trends, district or nearby results, class-ambiguous snippets, or no numeric exact-city
trend; none satisfied explicit one-star class plus two-adult one-room occupancy and tax treatment.

The experiment used exactly two ordered Expedia searches per city, with no page reads, retries, fallback sources,
arithmetic, FX conversion, or cross-city evidence. Retain the nine three-star rows as source evidence, but do not
map them or fit a one-star ratio. A new source or an explicitly amended estimand would require a separate
pre-registered validation design; source-default one-star averages remain ineligible under the frozen dictionary.

See `results.json` and `audit.json` for deterministic counts and `*-telemetry.json` for per-city protocol evidence.
