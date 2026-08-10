# Collection audit

The first parallel delegation launched more city calls than the orchestration response reported. A later
duplicate Cape Town response arrived after the primary set had been assigned. The primary response is the
observed `$92` result from the first preregistered call; the later `not_found` response is retained above as
`cape-town-duplicate-discarded.json` and is excluded from `results.json`. This choice is by invocation order,
not by result, and the duplicate is not counted in the experiment's 15-call / 52-search totals.

Delegated final messages did not expose provider token counts or wall-clock latency. The per-city telemetry
files record those fields as `null` rather than inventing them; call count, retry count, search count, block
status and direct-page-read status are preserved from each raw response.
