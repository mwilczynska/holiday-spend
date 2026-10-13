# Goal prompt: city-cost accuracy

Prepared 13 October 2026. Paste the block below to start the bounded campaign. Creating this file has not
activated a goal. All estimate generation uses subscription-backed inexpensive model subagents, as in the
previous city batches. No paid provider API calls or API keys are needed.

```text
/goal Complete a bounded, reproducible evaluation of Holiday Spend's city-cost accuracy and determine whether a simple methodology change improves it on the cheap LLMs intended for the published app.

Work only in C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend on research/city-cost-accuracy. Read PLAN.md and docs/dev/plans/city-cost-accuracy.md and follow that protocol. This request reopens city-cost measurement and calibration for this workstream despite the older closure. Old v5/v6 holdouts remain closed.

Run every estimate through fresh cheap-model subagents, as with the previous city batches. Use GPT-6 Luna at max reasoning and Haiku 5.5 at its supported setting when available. Do not make paid provider API calls, access application keys, or substitute the stronger coordinator's answers. Use fresh contexts without parent history, reference answers or previous predictions. Give each agent the exact versioned prompt, save its JSON and truthful search provenance, check the prompt hash, then run deterministic validation/materialization/scoring without persistence. Record the exact model, effort and agent/tool environment. Missing second-model access limits the conclusion; it does not require an API fallback.

First freeze definitions, reference selection, metrics, missingness penalties, practical improvement margins and resource limits. Establish unchanged v1.1 with repeated fresh subagent runs. Begin with six development cities to establish reference feasibility, then use the planned 16-development/eight-confirmation city design if feasible. Keep incomplete coverage visible; useful category results do not require complete truth for all 19 fields.

Build an isolated replayable harness and collect independent, definition-matched public references. Separate reference research from prediction workers. The coordinator may delegate collection and review, but LLM estimates or consensus are not price truth. Distinguish source reproduction, price accuracy, basket assumptions and actual spending. Do not use current CSV values as independent truth. Preserve attempts, failures, missingness, citations and uncertainty. Private spending analysis requires separate authorization.

Iterate through at most six preregistered candidates, one principal change at a time. Prioritize the largest baseline errors and simple fixes: clearer definitions, direct weak-tier anchors, simple calibrated relationships, bounded search or selective hybrids. Test small pilots, extend at most two promising candidates, and compare every change with both v1.1 and the incumbent on identical evidence. Reuse saved anchors for formula-only tests.

Use the plan's paired city-level metrics and regression checks. Freeze one finalist before collecting/revealing fresh confirmation evidence; run baseline and finalist three times per confirmation city. Do not tune on confirmation results. Report supported improvement, promising but unconfirmed, no improvement, or insufficient evidence honestly.

Use at most 400 delegated city-estimation invocations including repeats/retries, reserving 100 for confirmation, and 300 reference retrieval actions. Run at most three estimation workers concurrently. A candidate's ordinary serving method is limited to three model invocations and eight searches per city; prefer one call unless an extra call earns a measured benefit. Record calls, searches, available tokens and elapsed time, including failures. API costs and API transport performance are unmeasured and are not required for this campaign.

Stop new experiments after six candidates, three consecutive non-improvements, or a resource ceiling, and finish the bounded report. Do not raise caps, relax acceptance rules or reopen confirmation to manufacture a win. If subscription limits or missing tools block execution, checkpoint results, complete independent work and identify what is needed; never switch to paid APIs.

Deliver a reproducible baseline report, references and protocol, experiment ledger, model-specific leaderboard, final comparison and justified recommendation. A well-supported decision to retain v1.1 is a successful research outcome. A harness without measurements is not. Implement candidates only as isolated research methods; do not change production defaults, migrate cities, write the canonical CSV, modify the main database, deploy or merge.

Update PLAN.md with the exact next action and append evidence to LOG.md at every milestone. Commit and push verified checkpoints on this research branch. Follow goal lifecycle rules for genuine blockers; never declare an unfinished evaluation complete. Continue autonomously within these boundaries until the bounded evaluation and final recommendation are complete.
```
