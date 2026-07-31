# Experiment 027 — verdict

**Verdict: reject HOTEVI as a production accommodation source for now; retain as a calibration candidate.**

Three independent one-city Luna calls issued exactly three HOTEVI-restricted searches each (nine searches and
nine search operations), with no page reads, retries, fallbacks, arithmetic, FX, or cross-city evidence. Only
Hanoi returned all three exact grouped rows (Budget 1–2 star $30, Mid-Range 3 star $65, Luxury 4–5 star $150,
July 2026). Lisbon's snippets exposed grouped values but no exact row month/date; Copenhagen produced no exact
city rows. Strict coverage was 3/9 cells, one complete city.

Even the accepted Hanoi rows have `occupancyBasis = unknown` and grouped tiers (1–2 and 4–5 stars). They are
not `accom_1_star`–`accom_4_star` two-adult observations. HOTEVI's public methodology describes monthly
aggregated nightly rates and grouped tiers, but the target search result does not establish the product's
two-adult room basis. No grouped value is mapped or scaled.

This is source-feasibility evidence, not ground truth or a model. Retain HOTEVI only as a possible external
calibration benchmark if a definition-matched city panel can be assembled; do not use it in the production
one-call cascade or treat its grouped classes as complete accommodation coverage.
