# Verdict — reject direct Numbeo page path for target reliability

The canonical URL normalization hypothesis was falsified in two separate one-city calls. The Copenhagen
page returned HTTP 503 Service Unavailable and the Prague page returned HTTP 429 Too Many Requests; all ten
measure cells were therefore blocked before page rows were available. No lowercase retry, search fallback,
other city, arithmetic, or estimate was used.

Experiment 014's Lisbon success remains valid as a source/page observation, but these two canonical failures
show that the direct Numbeo page path is not reliably usable at the required low steady-state volume in the
delegated target web environment. The failures are recorded as `blocked`, not `not_found`.

**Decision:** reject direct Numbeo page retrieval as the production source route unless a different safe
retrieval mechanism is demonstrated. Test search-result extraction or another free source, and measure its
rate-limit behaviour separately. The one-city invocation shape remains mandatory.

Exact provider model ID, parameters, tokens, latency, and cost were not exposed.
