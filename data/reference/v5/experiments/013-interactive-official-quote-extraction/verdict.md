# Verdict — reject direct booking-engine URLs for the target web path

Three independent Copenhagen-only Luna invocations attempted the same five known official booking-engine
URLs with fixed dates, two adults, and one room. All **15/15 quote cells were blocked** at the delegated web
safety boundary before page content was available. No totals, room names, tax facts, arithmetic, or substitute
searches were produced. The three runs agreed on the blocked outcome.

This is not evidence that the public property pages are intrinsically inaccessible: the existing manual
ground-truth capture opened these same engines and accepted five exact dated quotes. It is evidence that this
target-model/web-tool path cannot currently use arbitrary long booking-engine URLs, even when the URL query
contains the correct dates and occupancy. A production prompt relying on that interaction would fail closed.

**Decision:** reject this direct interactive booking URL route for target-model production. Retain the
one-city invocation shape and the blocked outcome as telemetry. Test safe, stable page templates or a free
source that the target web tool can actually open; do not relabel these blocks as `not_found` or infer prices.
The existing direct-property quotes remain valid manual ground truth but are not target-model feasibility
evidence.

Telemetry across the three tasks recorded 15 URL attempts, zero successes, zero general searches, and no
exposed provider model ID, parameters, tokens, latency, or cost. Browser runtime availability was false in
the delegated environment.
