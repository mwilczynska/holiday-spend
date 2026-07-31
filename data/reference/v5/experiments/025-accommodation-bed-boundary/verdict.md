# Experiment 025 — verdict

**Verdict: promote the one-bed dorm input boundary, but reject complete accommodation acceptance.**

Three independent one-city calls repeated Barcelona, Prague, and Nairobi. Each issued six targeted searches
(18 searches and 18 search operations), with no direct reads, retries, fallbacks, arithmetic, FX, or cross-city
evidence. The revised boundary accepted 6/18 cells, up from 3/18 in Experiment 024: Barcelona dorm €15 per
bed, Barcelona 3-star and 4-star, Nairobi 3-star and 4-star, and Prague 4-star. No city was complete; private
hostel, 1-star, and 2-star remained unresolved, and Prague's dorm still exposed only `from`/residence values.

The Barcelona 4-star value is displayed in PLN for a Barcelona source page. It remains an observed source-
currency fact only and needs deterministic FX/display-currency review; it must not be silently treated as EUR.
Nairobi values are USD display values. The dorm row remains one-bed observed input; only deterministic server
code may scale it by two for the two-traveller product value.

This is target-model retrieval evidence, not independent ground truth. Promote the bed-boundary contract for
future collection, but fit no accommodation ratios or impute missing classes until a definition-matched panel
contains 30 complete cities and at least 10 locked holdout cities.
