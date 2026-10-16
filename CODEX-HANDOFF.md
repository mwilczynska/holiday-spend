# Codex handoff: collect only

Written 16 October 2026 by the Claude Code coordinator of the hill-climb program
(`research/city-cost-accuracy/hillclimb/PROGRAM.md`). Read this file first. It tells a Codex session exactly what to
run. **This session collects data. It does not design, create, change or judge anything.**

Worktree: `C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend`, branch `research/city-cost-accuracy`.

## Scope

Allowed:
- Answer already-frozen prediction tasks (Job A) with fresh GPT-6 Luna / Max subagents.
- Run the existing dispatcher for frozen Claude/Haiku iterations when Claude usage is available (Job B).
- Run the existing browser and Numbeo collectors on the provided to-do lists (Jobs C, D).
- Run the mechanical `ingest` / `assess` / `rescore` commands listed in Job E, save raw outputs, commit and push.
- Append factual progress lines to `LOG.md` and update counts in the `PLAN.md` status block.

Not allowed (leave for the coordinator):
- Creating, editing or deleting any iteration, `candidate.json`, `freeze.json`, `prompt.txt`, `system.txt`, spec or
  transform; editing `PROGRAM.md`, `LOOP.md`, scripts or panel manifests; rebuilding the panel.
- Editing, "fixing", rerunning for a better answer, or discarding any worker response.
- Reading the sealed test split (`score.mjs --test`) or comparing iterations beyond the listed commands.
- Interpreting verdicts, accepting/rejecting changes, or proposing new candidates.
- Production code, the canonical CSV, the main database, deployment, paid APIs or application keys.

If something is unclear or broken, stop that job, write what happened in `LOG.md`, commit, and continue with another
job. Do not improvise a fix.

## Status at handoff

```bash
node scripts/city-cost-accuracy/hillclimb/queue.mjs --status
```

| Iteration | What it is | Runs on |
| --- | --- | --- |
| `101-v11-luna-r2` | Production v1.1 prompt, GPT-6 Luna lane, 333 R2 dev cities, 1 run each | **Codex (Job A)** |
| `014-v11-haiku-high-r2` | Same prompts, Haiku effort **high** (screening lane), 333 R2 dev cities, 1 run | Claude CLI (Job B, first) |
| `008-accommodation-definitions` | Accommodation-definition candidate, R1 dev, 2 repeats | Claude CLI (Job B) |
| `009-search-grounded` | Search-grounded candidate, R1 dev, repeat 1 only (expensive) | Claude CLI (Job B) |
| `011-v11-haiku-baseline-r2` | Same prompts, Haiku effort max; paused (expensive), lowest priority | Claude CLI (Job B, last) |
| `012`, `013` | Effort test and its comparator: complete | none |
| `015-spec-definitions-r2`, `016-accommodation-definitions-r2` | Round-2 screening candidates on R2, Haiku high, 1 run | Claude CLI (Job B) |
| `010-comparable-context-5` | Withdrawn. Never dispatch | none |

## Job A — answer Luna tasks (Codex quota; main job)

Each task folder holds `system.txt` and `prompt.txt`. Get the next folders in priority order:

```bash
node scripts/city-cost-accuracy/hillclimb/queue.mjs 101-v11-luna-r2 --limit 12
```

For each folder, spawn one **fresh** subagent with **GPT-6 Luna, reasoning Max** (verify the exact model and effort;
if unavailable, stop Job A and log it; never substitute). At most 6 at a time. Give the subagent only this text, with
the two files' contents pasted in verbatim:

```text
System instruction:
<contents of system.txt>

User request:
<contents of prompt.txt>

Follow the request exactly. Use web search only where the request permits it. Your final message must be only the
JSON object the request asks for.
```

Do not give it any other file, reference price, earlier answer, score or context.

When it finishes:
1. Save its final message **verbatim** as `response.json` in that task folder (even if it is not valid JSON; the
   ingest step records failures).
2. Write `run.json` in the same folder:
   `{"runtime":"Codex subagent","model":"gpt-6-luna","effort":"max","startedAt":"<ISO>","finishedAt":"<ISO>","attempts":1,"searches":<count if known, else null>,"notes":""}`.
3. If a subagent produced no final message at all, you may retry once with a new subagent; record `"attempts":2` and
   the first failure in `notes`. Never retry a task that returned an answer.

Commit every ~25 tasks: `git add research/city-cost-accuracy/hillclimb/iterations/101-v11-luna-r2 && git commit -m
"Luna lane: N/333 answered" && git push`.

## Job B — Claude/Haiku dispatch (only when Claude usage is available)

Run from the worktree root, one at a time, in this order. Each command is resumable and fills only missing answers.
Stop when Claude usage runs out (workers then exit within seconds; that is expected).

```bash
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs 014-v11-haiku-high-r2 --concurrency 16
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs 015-spec-definitions-r2 --concurrency 12
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs 016-accommodation-definitions-r2 --concurrency 12
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs 008-accommodation-definitions --concurrency 8
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs 009-search-grounded --max-repeat 1 --concurrency 6
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs 011-v11-haiku-baseline-r2 --max-repeat 1 --max-tasks 100 --concurrency 12
```

Before each window, clear stale records (failures from a usage-limit stop):

```bash
find research/city-cost-accuracy/hillclimb/iterations -name .claim -delete
for d in research/city-cost-accuracy/hillclimb/iterations/*/tasks/*/; do [ -f "$d/run.json" ] && [ ! -f "$d/response.json" ] && rm "$d/run.json"; done
```

## Job C — Booking.com collection (in-app browser, logged-in booking.com tab; optional)

Only if browser automation works in this session. In a booking.com tab, run the contents of
`scripts/city-cost-accuracy/hillclimb/browser/booking-collect.js` with the javascript tool, then:

1. Main run, 217 remaining cities: set `CITIES` to the array in `panel/booking-todo-main.json` and run
   `window.__bkCollect(CITIES, 'main')`. Check progress with `({ n: window.__bkOut.length, done: window.__bkDone })`.
2. When done (or before stopping), export: `JSON.stringify(window.__bkOut) + ' '.repeat(200000)`. The tool saves an
   oversized result to a file; convert it with
   `node scripts/city-cost-accuracy/hillclimb/extract-browser-json.mjs <saved-file> research/city-cost-accuracy/hillclimb/panel/booking-main-part2-<date>.raw.json`,
   then `node scripts/city-cost-accuracy/hillclimb/ingest-platforms.mjs booking <that file> r3-booking-part2-<date>`.
3. Window run, 333 dev cities, in a fresh page load: `window.__bkCollect(CITIES_FROM_booking-todo-windows.json, 'windows')`.
   Export the same way to `panel/booking-windows-<date>.raw.json`. **Do not ingest the window run**; the coordinator
   defines how windows become references.

Do not change the queries, dates, filters or parsing in the collector.

## Job D — Numbeo (no browser, slow; optional)

```bash
bash scripts/city-cost-accuracy/hillclimb/collect-numbeo-loop.sh research/city-cost-accuracy/hillclimb/panel/expansion-candidates.json r3-numbeo-2026-10-15 20000
```

It resumes from its log, pauses 10 minutes after rate limits, and stops itself after repeated 429s. If Numbeo shows
"Access Restricted/Forbidden", stop and log it.

## Job E — mechanical scoring (after any iteration reaches all its tasks)

Run only these, only for iterations whose tasks are all answered (`queue.mjs --status` shows nothing pending for it),
and paste the printed lines into `LOG.md` without commentary.

```bash
H=scripts/city-cost-accuracy/hillclimb
# 008, 009 and 012: raw and calibrated assessments
node $H/iterate.mjs ingest 008-accommodation-definitions && node $H/iterate.mjs assess 008-accommodation-definitions
node $H/make-calibrated.mjs 008-accommodation-definitions --parent 001-v11-haiku-baseline-cal-region --group region
node $H/iterate.mjs ingest 008-accommodation-definitions-cal-region && node $H/iterate.mjs assess 008-accommodation-definitions-cal-region
# same three lines with 009-search-grounded
# 015 and 016 (R2 screening candidates): raw and calibrated against the R2 screening baseline 014
node $H/iterate.mjs ingest 014-v11-haiku-high-r2
node $H/make-calibrated.mjs 014-v11-haiku-high-r2 --group region && node $H/iterate.mjs ingest 014-v11-haiku-high-r2-cal-region
node $H/iterate.mjs ingest 015-spec-definitions-r2 && node $H/iterate.mjs assess 015-spec-definitions-r2
node $H/make-calibrated.mjs 015-spec-definitions-r2 --parent 014-v11-haiku-high-r2-cal-region --group region
node $H/iterate.mjs ingest 015-spec-definitions-r2-cal-region && node $H/iterate.mjs assess 015-spec-definitions-r2-cal-region
# same three lines with 016-accommodation-definitions-r2
# 014, 011 and 101: ingest only (scores without verdicts)
node $H/iterate.mjs ingest 014-v11-haiku-high-r2
node $H/iterate.mjs ingest 011-v11-haiku-baseline-r2
node $H/iterate.mjs ingest 101-v11-luna-r2
```

`ingest` of a partly answered iteration is harmless but its score is not meaningful (missing answers are penalised);
prefer to wait until complete.

## End of session

1. `node scripts/city-cost-accuracy/hillclimb/queue.mjs --status` and paste it into the `PLAN.md` status block.
2. Append a dated `LOG.md` entry: what ran, counts, failures, anything stopped and why.
3. `npm run docs:check-memory`, commit, push.
