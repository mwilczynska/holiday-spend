# Verdict — revise URL normalization and retest

The Lisbon one-city call successfully opened the canonical case-correct Numbeo page and returned all five
requested rows. All five found facts were source-audited. In comparison with prior accepted Lisbon
observations, inexpensive meal, mid-range meal, and beer matched exactly; cappuccino differed by 0.8% with
different retrieval dates; McMeal had no prior retained observation.

Copenhagen and Prague used lowercase URL slugs and were blocked by the delegated web surface before any page
content was available. Lisbon's first lowercase URL also failed (503/cache miss), but the canonical
case-correct `/in/Lisbon` URL succeeded without a search fallback. This is a URL-normalization failure, not
evidence that Numbeo lacks those city pages.

**Decision:** do not reject Numbeo. Revise the source contract to derive and try the canonical city-name URL
once, retain the lowercase failure as telemetry, and retest Copenhagen and Prague as separate one-city
calls. The method still has no activity or accommodation evidence and has not passed a production coverage
or final accuracy gate.

No arithmetic, FX, snippets, fallback search, or unsupported values were emitted. Provider model ID,
parameters, tokens, latency, and cost were not exposed.
