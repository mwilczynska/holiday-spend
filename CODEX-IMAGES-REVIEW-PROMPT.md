# Codex launch prompt: city photo review (529 cities)

Prepared 18 October 2026 by the Claude Code coordinator. Launched from the worktree root
`C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend` with:

```bash
codex exec --approve-for-me -c sandbox_workspace_write.network_access=true - < CODEX-IMAGES-REVIEW-PROMPT.md
```

Everything below the line is the prompt.

---

You are running a review job in this repository. Work autonomously from start to finish. Do not ask the owner
questions, do not pause for confirmation, and do not end your turn until a stop condition below is met. Checkpoint
commits are not stopping points: commit, push, and keep going.

## Context

The Holiday Spend app shows a free Wikimedia Commons photo for each of its 529 cities. Your job is to have each photo
looked at once by a fresh GPT-6 Luna worker and to save its verdict. The coordinator prepared one task per city in
`research/city-images-review/2026-10-18/tasks/<cityId>/message.txt`. Below, `<DIR>` means
`research/city-images-review/2026-10-18`.

The image files live outside this worktree, in `C:\Dev\holiday-spend\data\city-images\`. Workers only read them. Never
copy, move, modify or commit any image file.

## The loop

Repeat until the queue command prints nothing:

1. Get up to 6 pending task ids: `node scripts/city-images-review/queue.mjs <DIR> --limit 6`
2. For each task, the worker message is the full content of `<DIR>/tasks/<cityId>/message.txt`. Copy it byte for
   byte; never retype or summarise it.
3. Spawn one **fresh** subagent per task with model **GPT-6 Luna** at reasoning effort **Max**. Run **6 Luna Max
   subagents simultaneously** (or the maximum your current settings allow); never work through tasks one at a time.
   Give each worker only its message. The worker must open the image file named in the message to look at it.
4. When a worker finishes, write its final message **verbatim** to `<DIR>/tasks/<cityId>/verdict.json`, even if it is
   not valid JSON. Do not parse, fix or reformat it.
5. As soon as a slot frees, start the next task so all workers stay busy.
6. After every 48 saved verdicts, checkpoint:
   ```bash
   git add research/city-images-review
   git commit -m "City photo review: <saved>/529 verdicts"
   git push
   ```
   Stage only that folder; never use `git add -A` or `git add .`.

When the queue is empty, run `node scripts/city-images-review/queue.mjs <DIR> --summary`, save its output to
`<DIR>/summary.json`, then `git add research/city-images-review`, commit "City photo review complete", push and stop.

## When things go wrong (handle and continue)

| Situation | Action |
| --- | --- |
| A worker returns no final message | Retry once with a new fresh worker. If that also fails, write `{"verdict":"unsure","reason":"worker returned nothing"}` and move on. |
| A worker says it cannot open the image | Save its message verbatim anyway; it will count as a flagged case. Do not retry. |
| `git commit` fails because `.git/index.lock` exists | Wait 30 seconds and retry, up to 5 times. Never delete the lock file. |
| `git push` fails | Run `git pull --rebase` once, then push again. If it still fails, keep committing locally. |

## Stop conditions (the only reasons to stop)

1. The queue is empty and the finishing commands above have run.
2. GPT-6 Luna at Max is unavailable. Never substitute another model or effort.
3. Your usage limit is reached. Let running workers finish, save their verdicts, commit and push.

On any stop, append a dated entry to `LOG.md` (verdicts saved, retries, failures, stop reason), `git add LOG.md
research/city-images-review`, commit, push and stop.

## Never

- Copy, move, edit, delete or commit image files, or touch `C:\Dev\holiday-spend` in any way other than reading images.
- Save or commit worker transcripts, event streams, stderr or other logs (for example `worker-cli*` files). Only
  `verdict.json` belongs in a task folder; this repository is public.
- Touch anything outside `research/city-images-review` and `LOG.md`.
- Use API keys or paid APIs.
