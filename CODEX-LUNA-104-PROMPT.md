# Codex launch prompt: Luna lane 104 (accommodation search, 100-city sample)

Prepared 17 October 2026 by the Claude Code coordinator, who designed and registered iteration
`104-search-accommodation-luna-s100` and is the only one who scores, compares or interprets it. Launched from the
worktree root `C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend` with:

```bash
codex exec --approve-for-me -c sandbox_workspace_write.network_access=true - < CODEX-LUNA-104-PROMPT.md
```

Budget note: 100 calls. The Codex weekly window had about 19% left when this was written, enough for roughly 110 to 130
Luna Max calls. Partial collection is still useful.

Everything below the line is the prompt.

---

You are continuing a data-collection job in this repository. Work autonomously from start to finish. Do not ask the
owner questions, do not pause for confirmation, and do not end your turn until a stop condition below is met.
Progress checkpoints (commits) are not stopping points: commit, push, and keep going.

## Context

This worktree runs a research program measuring city-cost estimate accuracy (`research/city-cost-accuracy/hillclimb/`).
The coordinator has registered and frozen one iteration, `104-search-accommodation-luna-s100`: 100 tasks, one per
city. Your only job is to collect answers to its frozen prompts, one fresh GPT-6 Luna subagent at reasoning effort Max
per task, exactly as you did for iterations 101, 102, 201 and 202. Below, `<IT>` means
`104-search-accommodation-luna-s100`.

These prompts allow the worker up to ten web searches, including accommodation searches. That is expected; do not add,
remove or restrict anything.

Never work on any other iteration, even if `queue.mjs --status` lists pending tasks for it.

## The loop

Repeat until the queue command prints nothing:

1. Get up to 6 pending task folders:
   ```bash
   node scripts/city-cost-accuracy/hillclimb/queue.mjs <IT> --limit 6
   ```
   The task id is the folder's last path segment (for example `aarhus-r1`).
2. For each task, print its exact worker message:
   ```bash
   node scripts/city-cost-accuracy/hillclimb/codex-task-message.mjs <IT> <task-id>
   ```
   The worker message is everything between `=====BEGIN WORKER MESSAGE=====` and `=====END WORKER MESSAGE=====`.
   Copy it byte for byte. **Never retype, summarise, reformat or "clean up" prompt text.** A hand-retyped prompt
   once corrupted a task (Alicante). Note the `promptSha256=` value for the run record.
3. Spawn one **fresh** subagent per task with model **GPT-6 Luna** and reasoning effort **Max**. Run **6 Luna Max
   subagents simultaneously** (your settings allow 6 concurrent subagents; if a spawn reports a lower limit, use the
   maximum your current settings allow). Never work through tasks one at a time. Give it only the worker message: no other files, prices, earlier answers (including answers for the same
   city in other iterations), scores or context.
4. When a worker finishes, write its final message **verbatim** to `<task folder>/response.json`. Write the text
   exactly as returned, even if it is not valid JSON. Do not parse and re-serialise it, do not trim fences, and do
   not fix anything.
5. Write `<task folder>/run.json`:
   `{"runtime":"Codex subagent","model":"gpt-6-luna","effort":"max","startedAt":"<ISO>","finishedAt":"<ISO>","attempts":1,"searches":<count or null>,"promptSha256":"<from step 2>","notes":""}`
6. As soon as a slot frees, start the next task, so all 6 workers (or your maximum) stay busy until the queue is
   empty.
7. After every 24 saved answers, checkpoint:
   ```bash
   git add research/city-cost-accuracy/hillclimb/iterations/<IT>
   git commit -m "Luna 104: <answered>/100 answered"
   git push
   ```
   Stage only that folder. Another agent commits other paths in this worktree, so never use `git add -A` or
   `git add .`. Then continue the loop immediately.

When the queue is empty, finish:

```bash
node scripts/city-cost-accuracy/hillclimb/iterate.mjs ingest <IT>
git add research/city-cost-accuracy/hillclimb/iterations/<IT>
git commit -m "Luna 104 complete"
git push
```

Never run `score.mjs`, `assess`, any other ingest, or anything with `--test`.

Count answered tasks at any time with `node scripts/city-cost-accuracy/hillclimb/queue.mjs --status`.

## When things go wrong (handle and continue)

| Situation | Action |
| --- | --- |
| A worker returns no final message at all | Retry once with a new fresh worker, record `"attempts":2` and the first failure in `notes`. If the retry also fails, write no `response.json`, note it for the final log, and move on. |
| A worker returns text that is not valid JSON | Save it verbatim anyway. That is a result, not an error. Do not retry. |
| `codex-task-message.mjs` reports a hash mismatch or an existing answer | Skip that task, note it for the final log, and continue with the next. |
| `git commit` fails because `.git/index.lock` exists | Wait 30 seconds and retry, up to 5 times. Never delete the lock file. |
| `git push` fails (network or rejected) | Run `git pull --rebase` once, then push again. If it still fails, keep committing locally and retry the push at the next checkpoint. |
| A subagent cannot be spawned for a temporary reason | Wait 60 seconds and retry, up to 5 times, then continue with the next task. |

## Stop conditions (the only reasons to stop)

1. **The queue for `<IT>` is empty** and the finishing commands above have run.
2. **GPT-6 Luna at Max is unavailable** (not offered, or every spawn is refused for that model). Never substitute
   another model or effort.
3. **Your usage limit is reached.** Let running workers finish if possible and save their answers.

On any stop: run `node scripts/city-cost-accuracy/hillclimb/queue.mjs --status`, append a dated entry to `LOG.md`
(answers collected this session, retries, failures, skipped tasks, the ingest output line if run, and the stop reason
with any exact error), then `git add LOG.md research/city-cost-accuracy/hillclimb/iterations/<IT>`, commit, push,
and stop.

## Never

- Edit, re-run for a better answer, or delete any existing `response.json`, `run.json`, `prompt.txt`, `system.txt`,
  `freeze.json`, `candidate.json` or `prompt.md`.
- Touch other iterations, scripts, panels, `PROGRAM.md`, `LOOP.md`, `PLAN.md`, or anything outside the `<IT>` folder
  and `LOG.md`.
- Read reference panels (`research/city-cost-accuracy/hillclimb/panel/`), score, compare or interpret results, or
  run anything against the sealed test split.
- Use API keys or paid APIs, or change production code, the canonical CSV or the main database.
