# Hill-climb loop playbook

How to run one round of the program in [PROGRAM.md](PROGRAM.md) from a cold start. Paths are relative to the
worktree root `C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend`.

## 0. Orient (2 minutes)

```bash
cat research/city-cost-accuracy/hillclimb/PROGRAM.md        # sections 3, 5, 9 and 10 especially
cat research/city-cost-accuracy/hillclimb/leaderboard.csv
ls research/city-cost-accuracy/hillclimb/iterations
```

The incumbent is named in PROGRAM.md section 9. Never edit a frozen iteration (one with `freeze.json`); register a
new one instead.

## 1. Pick candidates

Take the top untested rows of the backlog (section 10), favouring the anchor with the largest weighted error in
the incumbent's `score-dev.json` (`perAnchor.meanAbsLog` × budget weight). Run 2–4 candidates per round, each one
principal change against the incumbent's prompt. Replay candidates (transforms, calibration, ensembles) cost
nothing and can run any time.

Write a spec in `research/city-cost-accuracy/hillclimb/specs/NNN.json` (see 002–005 for the format; a later
candidate's `baseTemplate` is the incumbent's `iterations/<id>/prompt.md`) and create it:

```bash
node scripts/city-cost-accuracy/hillclimb/make-candidate.mjs research/city-cost-accuracy/hillclimb/specs/NNN.json
node scripts/city-cost-accuracy/hillclimb/iterate.mjs prepare NNN-slug
```

## 2. Dispatch (background)

```bash
node scripts/city-cost-accuracy/hillclimb/dispatch.mjs NNN-slug --concurrency 8 > research/city-cost-accuracy/hillclimb/iterations/NNN-slug/dispatch.log 2>&1
```

One headless `claude -p` process per task: Haiku 5.5, max effort, `system.txt` as system prompt, `prompt.txt` on
stdin, WebSearch only, no MCP, empty working directory. About 3 minutes per task; total concurrency up to ~20 has
run without failures. `iterate.mjs status NNN-slug` lists missing responses; rerunning dispatch fills only gaps.

Luna lane (confirmation): run the same frozen `prompt.txt`/`system.txt` through Codex GPT-6 Luna/Max workers and
save each final answer verbatim as `response.json` in a copy of the iteration with `lane` changed.

## 3. Score and judge

```bash
node scripts/city-cost-accuracy/hillclimb/iterate.mjs ingest NNN-slug
node scripts/city-cost-accuracy/hillclimb/iterate.mjs assess NNN-slug            # against candidate.parent
node scripts/city-cost-accuracy/hillclimb/iterate.mjs assess NNN-slug --against <incumbent>
```

`assess` applies the frozen rule and appends a leaderboard row. Write `iterations/NNN-slug/NOTES.md`: what changed,
verdict, per-anchor deltas, and what it suggests next. On **accept**, update the incumbent in PROGRAM.md section 9.
On **promising_extend**, add one repeat (raise `repeats` in a new registration that replays the same prompt) and
reassess once.

## 3a. Progress plot

After any assess, add the experiment to the register in `scripts/city-cost-accuracy/hillclimb/build-progress.mjs` (if new),
run `node scripts/city-cost-accuracy/hillclimb/build-progress.mjs`, and republish `research/city-cost-accuracy/hillclimb/progress.html`
(artifact https://claude.ai/artifact/GSdP69DDreugCNUwX2HfcC).

## 4. After the panel grows

```bash
node scripts/city-cost-accuracy/hillclimb/build-panel.mjs                       # composes references.jsonl
for d in research/city-cost-accuracy/hillclimb/iterations/*/; do node scripts/city-cost-accuracy/hillclimb/iterate.mjs rescore $(basename $d); done
```

Scores carry the panel hash and `assess` refuses to compare scores from different panels.

## 5. Milestones

- Every 5 accepted changes: ablation (remove each accepted change in turn) and one sealed test read
  (`node scripts/city-cost-accuracy/hillclimb/score.mjs <predictions> --test`, logged in `panel/test-access.jsonl`).
- Before proposing anything for production: Luna-lane confirmation of the incumbent and of v1.1 on dev.
- Append a dated LOG.md entry and update PLAN.md; commit and push the research branch.

## Rules that do not bend

- Prediction workers never see references, scores or other answers.
- References come from collectors that parse saved pages deterministically, or from model collectors whose numbers
  are re-found in the refetched page. Model estimates are never references.
- Fitted parameters are evaluated leave-one-city-out.
- Production code, the canonical CSV and the main database are not changed by this program.
