# Experiment 024 — verdict

**Verdict: reject the strict six-class panel route; revise the collection boundary.**

Three independent one-city calls issued exactly six searches each (18 searches and 18 search operations).
Only 3/18 cells passed strict identity and provenance checks: Barcelona and Prague 3-star averages, and
Nairobi 4-star average. No city was complete. Hostel dorm/private results were per-bed, `from`, mixed, or
missing the required two-adult basis; 1-star and 2-star results lacked compatible occupancy or class evidence;
other 4-star results were date-specific, ranged, or lacked occupancy.

The Nairobi raw response omitted per-measure `searchQuery` fields, but its standalone telemetry preserves the
six exact queries; the deterministic audit accepts that explicit telemetry join and records the provenance
exception. Its 4-star value is displayed in TRY for a Nairobi source page and must remain flagged for currency
display review rather than being silently treated as Kenyan shillings.

This is target-model retrieval evidence, not independent ground truth. Do not fit accommodation ratios from
these three rows. The next experiment should test a mixed deterministic boundary: accept explicit per-bed
hostel prices as one-bed observed inputs and scale to two travellers in local code, while retaining strict
two-adult per-room rules for hotel classes. Do not relax class, city, source, or date identity to manufacture a
complete panel.
