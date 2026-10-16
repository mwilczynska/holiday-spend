# Codex launch prompt: Luna lane 102 (food and drink search) without stopping

Prepared 16 October 2026 by the Claude Code coordinator. Launch from the worktree root
`C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend` (branch `research/city-cost-accuracy`) with:

```bash
codex exec --approve-for-me -c sandbox_workspace_write.network_access=true - < CODEX-LUNA-102-PROMPT.md
```

`--approve-for-me` routes approval requests through automatic review in the workspace-write sandbox, so the run never
waits for a person; the network setting lets `git push` work. If pushes still fail, the prompt keeps committing
locally and the coordinator pushes afterwards. To resume a stopped run instead of starting a new one:
`codex exec resume <SESSION_ID> "Continue with CODEX-LUNA-102-PROMPT.md until a stop condition is met."`

Everything below the line is the prompt.

---

You are continuing a data-collection job in this repository. Work autonomously from start to finish. Do not ask the
owner questions, do not pause for confirmation, and do not end your turn until a stop condition below is met.
Progress checkpoints (commits) are not stopping points: commit, push, and keep going.

## Context

This worktree runs a research program measuring city-cost estimate accuracy (`research/city-cost-accuracy/hillclimb/`).
Your only job is to finish iteration `102-search-food-drink-luna-r2`: 333 frozen prediction tasks, one per city (prompts allow up to five food and drink price searches plus the exchange-rate search), each answered by a
fresh GPT-6 Luna subagent at reasoning effort Max. None are answered yet. The remaining tasks are listed by:

```bash
node scripts/city-cost-accuracy/hillclimb/queue.mjs 102-search-food-drink-luna-r2 --limit 6
```

`CODEX-HANDOFF.md` describes the wider collect-only scope. This prompt is the complete instruction for this session;
where they differ, follow this prompt.

## The loop

Repeat until the queue command prints nothing:

1. Get up to 6 pending task folders with the queue command above. The task id is the folder's last path segment
   (for example `cabo-san-lucas-r1`).
2. For each task, print its exact worker message:
   ```bash
   node scripts/city-cost-accuracy/hillclimb/codex-task-message.mjs 102-search-food-drink-luna-r2 <task-id>
   ```
   The worker message is everything between `=====BEGIN WORKER MESSAGE=====` and `=====END WORKER MESSAGE=====`.
   Copy it byte for byte. **Never retype, summarise, reformat or "clean up" prompt text.** A hand-retyped prompt
   previously corrupted one task (Alicante). Note the `promptSha256=` value for the run record.
3. Spawn one **fresh** subagent per task with model **GPT-6 Luna** and reasoning effort **Max**, at most 6 running at a
   time. Give it only the worker message. No other files, prices, earlier answers, scores or context.
4. When a worker finishes, write its final message **verbatim** to `<task folder>/response.json`. Write the text
   exactly as returned, even if it is not valid JSON; do not parse and re-serialise it, do not trim fences, do not fix
   anything.
5. Write `<task folder>/run.json`:
   `{"runtime":"Codex subagent","model":"gpt-6-luna","effort":"max","startedAt":"<ISO>","finishedAt":"<ISO>","attempts":1,"searches":<count or null>,"promptSha256":"<from step 2>","notes":""}`
6. As soon as a slot frees, start the next task, so 6 workers stay busy.
7. After every 24 saved answers, checkpoint:
   ```bash
   git add research/city-cost-accuracy/hillclimb/iterations/102-search-food-drink-luna-r2
   git commit -m "Luna lane: <answered>/333 answered"
   git push
   ```
   Stage only that folder. Another agent commits other paths in this worktree; never use `git add -A` or `git add .`.
   Then continue the loop immediately.

Count answered tasks at any time with `node scripts/city-cost-accuracy/hillclimb/queue.mjs --status`.

## When things go wrong (handle and continue)

| Situation | Action |
| --- | --- |
| A worker returns no final message at all | Retry once with a new fresh worker; record `"attempts":2` and the first failure in `notes`. If the retry also fails, write no `response.json`, record the failure in `LOG.md` at the end, and move on. |
| A worker returns text that is not valid JSON | Save it verbatim anyway. That is a result, not an error. Do not retry. |
| `codex-task-message.mjs` reports a hash mismatch or an existing answer | Skip that task, note it for the final log, continue with the next. |
| `git commit` fails because `.git/index.lock` exists | Wait 30 seconds and retry, up to 5 times. Never delete the lock file. |
| `git push` fails (network or rejected) | Run `git pull --rebase` once, then push again. If it still fails, keep committing locally and retry the push at the next checkpoint. |
| A subagent cannot be spawned for a temporary reason | Wait 60 seconds and retry, up to 5 times, then continue with the next task. |

## Stop conditions (the only reasons to stop)

1. **The queue is empty.** Then run, in order:
   ```bash
   node scripts/city-cost-accuracy/hillclimb/iterate.mjs ingest 102-search-food-drink-luna-r2
   node scripts/city-cost-accuracy/hillclimb/queue.mjs --status
   ```
   Append a dated entry to `LOG.md` (answers collected this session, retries, failures, skipped tasks, the ingest
   output line), update the counts line in the `PLAN.md` status block, then
   `git add LOG.md PLAN.md research/city-cost-accuracy/hillclimb/iterations/102-search-food-drink-luna-r2`, commit, push, stop.
2. **GPT-6 Luna at Max is unavailable** (not offered, or every spawn is refused for that model). Never substitute
   another model or effort. Commit and push what you have, log the exact error in `LOG.md`, stop.
3. **Your usage limit is reached.** Let running workers finish if possible, save their answers, commit and push,
   log the stop in `LOG.md`, stop.

## Never

- Edit, re-run for a better answer, or delete any existing `response.json`, `run.json`, `prompt.txt`, `system.txt`,
  `freeze.json` or `candidate.json`.
- Touch other iterations, scripts, panels, `PROGRAM.md`, `LOOP.md`, or anything outside the 101 folder, `LOG.md` and
  `PLAN.md`.
- Score, compare or interpret results (other than the single `ingest` at the end), or read the sealed test split.
- Use API keys or paid APIs, or change production code, the canonical CSV or the main database.
