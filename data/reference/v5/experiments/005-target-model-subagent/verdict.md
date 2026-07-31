# Verdict — revise and retest

The no-API-key spawned-agent route is valid for target-class prompt experimentation. The agent produced five
schema-complete contracts, retained all 18 keys, emitted no tiers/FX/arithmetic, and did not invent sparse
city prices.

It is not yet a winning one-call methodology:

- only 20 of 90 facts were found, all in the inexpensive/mid-range/fast-food/cappuccino/beer subset;
- accommodation, premium food, cocktails, wine, and activities remained unresolved;
- Don Det returned zero compatible facts;
- direct page reads returned HTTP 503;
- the orchestration surface does not expose exact provider model ID, parameters, tokens, latency, or cost.

Therefore this removes “no API key” as a blocker to prompt iteration, but it does not replace the final
production-path telemetry and held-out accuracy tests. The next prompt experiment should narrow or cascade
sources explicitly, reduce the 18-field search burden, and test whether accommodation/activity anchors can
be retrieved within a single spawned-agent task.

