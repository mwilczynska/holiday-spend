# City Cost v1.1 loop

Read `PLAN.md` and `docs/dev/handoffs/city-cost-v1-1.md` before acting. Continue from the first incomplete checklist
phase. `PLAN.md` is the progress artifact: update it when a task starts or finishes and before every commit or push;
keep one phase in progress and name one exact next action.

## Target

Ship the simple v1.1 path for newly generated cities while preserving v1 rollback. Keep all 19 planner tiers. The
model returns only the existing ten USD anchors in one schema-constrained call; deterministic server code applies the
exact v1 formulas and the checked-in FX snapshot. Persist methodology, provider/model, reasoning, prompt/formula, FX,
anchors, request context, and confidence provenance without inventing source grades or intervals.

## Stop rules

- Do not access, score, freeze, replace, or collect a holdout.
- Do not modify the live 121-city CSV or bulk-migrate existing cities.
- Do not refit accommodation, collect a new panel, run a lived-spending benchmark, or resurrect v6/v6.1.
- Do not put provider API keys in the repository, logs, database, or agent output.
- Fail closed on invalid anchors, unsupported countries, missing FX, provider failure, and partial persistence.
- Treat the keyed three-city smoke as operational validation only; it is not an accuracy claim.

## Completion sequence

1. Finish deterministic tests and the three-city owner-key smoke. If Chrome control is unavailable, repair the Browser
   plugin through the desktop app's **Settings → Computer use**; never substitute a synthetic provider result or read
   the owner's key.
2. If smoke passes, make v1.1 the new-city default and retain explicit v1 rollback; run the full baseline.
3. Remove stale active references to retired v6 work from current developer docs while retaining the archived branch,
   tag, and historical log entries.
4. Stop after the activation checkpoint for owner review; do not migrate the existing CSV without a separate decision.
