# Isolated accuracy tooling

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
