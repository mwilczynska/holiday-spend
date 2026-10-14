# Isolated accuracy tooling

The one authorized measurement redesign is complete: see
`research/city-cost-accuracy/redesign-1/REPORT.md` and its Astra assessment. Read-only reproduction:

```powershell
node --test scripts/city-cost-accuracy/redesign.test.mjs
node scripts/city-cost-accuracy/redesign.mjs summary
node scripts/city-cost-accuracy/redesign-budget.mjs show
```

No new source calls follow reproduction. The frozen helper verifies exact contract/code/input/raw hashes,
recorded original chronology and the immutable pre-assessment budget prefix while checking later lawful
accounting. Current Git checkout timestamps do not replace the recorded source timestamps. Missingness is
fixed at three cities/twelve slots/twenty-four extractions. Null metrics remain unmeasured, not zero.

`000-baseline`/`pilot-1` are immutable completed historical evidence. The example dispatch sequence below
documents that earlier run; do not dispatch those IDs again. Revised feasibility artifacts are separate under
`research/city-cost-accuracy/restart-1-prep/`. Its frozen source/contract files cannot be edited in place.

Read-only reproduction for the revised run:

```powershell
node --test scripts/city-cost-accuracy/core.test.mjs scripts/city-cost-accuracy/budget.test.mjs scripts/city-cost-accuracy/fees.test.mjs scripts/city-cost-accuracy/restart.test.mjs
node scripts/city-cost-accuracy/restart.mjs verify restart-1-prep
node scripts/city-cost-accuracy/restart.mjs budget restart-1-prep
node scripts/city-cost-accuracy/audit-final.mjs --self-test
node scripts/city-cost-accuracy/audit-final.mjs --replay
```

The audit verifies exact raw/request/prompt/source hashes, original validation and review outcomes, full
denominators, conservative unknown-action charges and the immutable pre-assessment journal prefix. Later
assessment accounting is checked separately without overwriting the earlier snapshot. Reservations are not
executed calls. `fees.mjs` requires explicit source charge bases/order; it never guesses tax rates.

`final-review.mjs` is a separately documented execution repair: it preserves genuine disputes from invalid
collector records as excluded diagnostics without changing their raw bytes, IDs, amounts or eligibility. It
cannot admit those records to primary references. Its selection/input replay is immutable. `envelope.mjs`
records mechanical delivery instructions, and `assessment-budget.mjs` splits protected design reservations
for the mandatory assessment. These are coordinator-only accounting/preparation, not LLM calls.

Run from the research worktree. These tools import the app's prompt builder and pure v1.1 materializer;
they never invoke a provider, load credentials or import a persistence service. Dependencies were installed
with lifecycle scripts disabled. A production build/native database check is not part of this research preflight.

```powershell
node --test scripts/city-cost-accuracy/core.test.mjs
npx tsx scripts/city-cost-accuracy/runner.ts prepare
npx tsx scripts/city-cost-accuracy/runner.ts verify
npx tsx scripts/city-cost-accuracy/runner.ts dispatch hanoi-luna-r1
# Dispatch one fresh gpt-6-luna/max subagent after the ledger entry is written.
# It reads only this run's system.txt, prompt.txt and request.json.
# Save response.json and provenance.json beside those inputs.
npx tsx scripts/city-cost-accuracy/runner.ts ingest hanoi-luna-r1
# Once all 18 baseline attempts have terminal results:
node scripts/city-cost-accuracy/summarize.mjs
```

`prepare` is idempotent only for identical content. Requests, prompts and processed results cannot be overwritten
by the runner. `dispatch` is coordinator-only and sequential: each entry consumes one invocation even on failure.
Never rerun a dispatched identifier; a retry requires a separately registered request and ledger entry.
Prepared requests do not consume invocations. Git records artifact history as an additional audit trail.
Artifact-recovery continuations are separately logged and conservatively added to the 400 call ceiling.
The summarizer freezes results once; an incomplete baseline cannot produce a completed summary.
Captured prompts preserve the app template's CRLF bytes and terminal blank line. Research Git attributes
treat CR as a line ending and permit that captured prompt's final blank line; they do not trim or rewrite it.

Worker provenance includes model, effort, runtime, promptSha256, startedAt, finishedAt, actions
(each search/open with query or URL and outcome), searchCount, retrievalCount, and tokenUsage (null when unavailable).
Model/effort are the settings selected by the coordinator and reported by the agent runtime, not inferred from prose.
Codex's surrounding tool/system environment is recorded as a transport difference; saved system.txt is the app's
instruction supplied to the subagent, not a claim that the subagent has an identical API system environment.

Failed app materialization remains a failed response. Valid anchors from a response with invalid FX may support
separately labelled anchor diagnostics, never successful production-output coverage. JSON parse errors are also retained.
The scoring core requires expected cells (including failed predictions), refuses duplicate cells and invalid references,
weights measures then categories then cities equally, and bootstraps paired cities rather than individual rows.

Only normalized public research artifacts belong here. No provider request headers, secrets, personal spending or
browser state. Old holdouts remain closed. The confirmation gate is additional to the separate sealed reference policy.
