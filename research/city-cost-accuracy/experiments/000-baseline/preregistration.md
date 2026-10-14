# 000: unchanged v1.1 baseline

Registered before estimates, 13 October 2026. This is a baseline, not one of the six candidate experiments.

- Six fixed pilot cities, GPT-6 Luna/max, three fresh no-parent subagents per city: 18 invocations.
- The app's exact prompt builder receives the protocol date/context. Same original ten anchors and formulas.
- Web search only for the RBA observation as required by the original prompt; no price searches.
- Save exact prompt/system bytes, SHA-256, response, runtime provenance and every failed attempt.
- No retries under a reused ID. At most eight search queries per invocation; stop with a recorded failure if necessary.
- Workers cannot read references, scores, other workers' answers or parent conversation history.
- Pure app materialization at dispatch time; no database persistence. Score matched evidence at independently frozen FX.
- Report contract success, FX correctness/freshness, anchor accuracy diagnostics and repeated-run dispersion separately.
- No numerical candidate hypothesis has been selected. Freeze the measurable scope after reference feasibility
  and before inspecting candidate outputs. Unsupported hotel dates or activity baskets remain missing.

The subscription subagent is an approximation of the production model environment. Exact application prompt text
does not imply identical provider-side web search tools, instruction hierarchy, API latency or API cost.
