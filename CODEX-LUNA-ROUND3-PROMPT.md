# Codex launch prompt: Luna round 3 (sealed test confirmation + dev replicate)

Prepared 16 October 2026 by the Claude Code coordinator, who designed and registered these iterations and remains
the only one who scores, compares or interprets them. Run it manually from the worktree root
`C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend` (branch `research/city-cost-accuracy`):

```bash
codex exec --approve-for-me -c sandbox_workspace_write.network_access=true - < CODEX-LUNA-ROUND3-PROMPT.md
```

Or paste everything below the line into an interactive Codex session. To resume a stopped run:
`codex exec resume <SESSION_ID> "Continue with CODEX-LUNA-ROUND3-PROMPT.md until a stop condition is met."`
Each phase is useful on its own, so stopping early (for example at a usage limit) loses nothing.

Everything below the line is the prompt.

---

You are continuing a data-collection job in this repository. Work autonomously from start to finish. Do not ask the
owner questions, do not pause for confirmation, and do not end your turn until a stop condition below is met.
Progress checkpoints (commits) are not stopping points: commit, push, and keep going.

## Context

This worktree runs a research program measuring city-cost estimate accuracy (`research/city-cost-accuracy/hillclimb/`).
The coordinator has registered and frozen three iterations. Your only job is to collect answers to their frozen
prompts, one fresh GPT-6 Luna subagent at reasoning effort Max per task. You do the same work you did for iterations
101 and 102. Work through the phases **in this order**, finishing each before you start the next:

| Phase | Iteration | Tasks | Purpose (for your information only) |
| --- | --- | --- | --- |
| 1 | `202-search-food-drink-luna-test` | 142 | Best method, on cities held back for confirmation |
| 2 | `201-v11-luna-test` | 142 | Previous method, on the same held-back cities |
| 3 | `103-search-food-drink-luna-r2-rep2` | 333 | A second independent answer to the 102 prompts |

Phases 1 and 2 cover sealed test cities. Their prompts contain only a city and a country, which is expected. You never
see or need reference prices, and you must not look for any.

Never work on any other iteration, even if `queue.mjs --status` lists pending tasks for it (009 and 011 belong to
another runtime).

## The loop (for the current phase's iteration `<IT>`)

Repeat until the queue command prints nothing:

1. Get up to 6 pending task folders:
   ```bash
   node scripts/city-cost-accuracy/hillclimb/queue.mjs <IT> --limit 6
   ```
   The task id is the folder's last path segment (for example `adelaide-r1`).
2. For each task, print its exact worker message:
   ```bash
   node scripts/city-cost-accuracy/hillclimb/codex-task-message.mjs <IT> <task-id>
   ```
   The worker message is everything between `=====BEGIN WORKER MESSAGE=====` and `=====END WORKER MESSAGE=====`.
   Copy it byte for byte. **Never retype, summarise, reformat or "clean up" prompt text.** A hand-retyped prompt
   once corrupted a task (Alicante). Note the `promptSha256=` value for the run record.
3. Spawn one **fresh** subagent per task with model **GPT-6 Luna** and reasoning effort **Max**, at most 6 running at a
   time. Give it only the worker message: no other files, prices, earlier answers (including the 102 answer for the
   same city in phase 3), scores or context.
4. When a worker finishes, write its final message **verbatim** to `<task folder>/response.json`. Write the text
   exactly as returned, even if it is not valid JSON. Do not parse and re-serialise it, do not trim fences, and do
   not fix anything.
5. Write `<task folder>/run.json`:
   `{"runtime":"Codex subagent","model":"gpt-6-luna","effort":"max","startedAt":"<ISO>","finishedAt":"<ISO>","attempts":1,"searches":<count or null>,"promptSha256":"<from step 2>","notes":""}`
6. As soon as a slot frees, start the next task, so 6 workers stay busy.
7. After every 24 saved answers, checkpoint:
   ```bash
   git add research/city-cost-accuracy/hillclimb/iterations/<IT>
   git commit -m "Luna round 3: <IT> <answered>/<total> answered"
   git push
   ```
   Stage only that folder. Another agent commits other paths in this worktree, so never use `git add -A` or
   `git add .`. Then continue the loop immediately.

When the queue for `<IT>` is empty, finish the phase:

```bash
node scripts/city-cost-accuracy/hillclimb/iterate.mjs ingest <IT>
git add research/city-cost-accuracy/hillclimb/iterations/<IT>
git commit -m "Luna round 3: <IT> complete"
git push
```

For phases 1 and 2, ingest prints `"scored":false`. That is correct: the sealed split is scored only by the
coordinator. Never run `score.mjs`, `assess`, or anything with `--test`. Then move to the next phase.

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

1. **All three phases are complete.**
2. **GPT-6 Luna at Max is unavailable** (not offered, or every spawn is refused for that model). Never substitute
   another model or effort.
3. **Your usage limit is reached.** Let running workers finish if possible and save their answers.

On any stop: run `node scripts/city-cost-accuracy/hillclimb/queue.mjs --status`, append a dated entry to `LOG.md`
(answers collected per iteration this session, retries, failures, skipped tasks, ingest output lines, and the stop
reason with any exact error), then `git add LOG.md` plus the iteration folders you touched, commit, push, and stop.

## Never

- Edit, re-run for a better answer, or delete any existing `response.json`, `run.json`, `prompt.txt`, `system.txt`,
  `freeze.json`, `candidate.json` or `prompt.md`.
- Touch other iterations, scripts, panels, `PROGRAM.md`, `LOOP.md`, `PLAN.md`, or anything outside the three
  iteration folders and `LOG.md`.
- Read reference panels (`research/city-cost-accuracy/hillclimb/panel/`), score, compare or interpret results, or
  run anything against the sealed test split other than the `ingest` commands above.
- Use API keys or paid APIs, or change production code, the canonical CSV or the main database.
