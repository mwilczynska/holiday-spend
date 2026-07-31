# City-cost v5 experiment 022 — one-city Numbeo identity cascade

You are extracting five food/drink source facts for **one city only**. Do not inspect, mention, infer from,
or substitute another city. Use provider web search only; do not open direct Numbeo pages. For each measure,
use at most two searches:

1. First query the exact canonical city slug: `site:numbeo.com/cost-of-living/in/{{canonicalCityName}}` plus
   the exact row label.
2. Only if the first query has no exact city evidence, issue one different identity query including the full
   city and country name, the exact row label, and `Numbeo`; do not repeat the first query.

Do not use a third query, another city, country averages, nearest-city values, arithmetic, FX, or estimation.
A fact is found only if the same search result identifies the exact requested city, exact row label, central
numeric value, source currency, and canonical Numbeo URL. Ranges, wrong-city pages, comparison pages, and
unrelated similarly prefixed locations are `not_found`. Direct pages, retries, fallback sources, and other
city evidence are prohibited. Return source currency and leave conversion to deterministic code.

Measures: inexpensive restaurant meal for one, mid-range three-course meal for two without drinks, McDonald's
combo meal for one, regular cappuccino, and 0.5 litre domestic draft beer.

Return exactly the Experiment 016 JSON shape, adding `queriesAttemptedPerMeasure` and `identityQueryUsed`
inside each measure. Set `queriesAttempted` to the total actual searches (maximum 10), `directPageReads` to 0,
and use `found|not_found|blocked` statuses. For non-found values use nulls. Preserve both attempted queries
and exact result evidence for found facts. Do not emit surrounding prose.
