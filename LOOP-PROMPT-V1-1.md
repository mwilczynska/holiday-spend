# City Cost v1.1 loop

Read `PLAN.md` and `docs/dev/handoffs/city-cost-v1-1.md` before acting. Continue from the first incomplete checklist
phase. `PLAN.md` is the progress artifact: update it when a task starts or finishes and before every commit or push;
keep one phase in progress and name one exact next action.

## Target

Ship the simple v1.1 path for newly generated cities while preserving v1 rollback. Keep all 19 planner tiers. The
model returns only the existing ten USD anchors in one schema-constrained call; deterministic server code applies the
exact v1 formulas and the checked-in FX snapshot. Persist methodology, provider/model, reasoning, prompt/formula, FX,
anchors, request context, and confidence provenance without inventing source grades or intervals.

## Current checkpoint - 25 August 2026

- The cleanup began with `main` and `origin/main` at `40f3c65`; v1.1 is already the default for newly generated cities,
  with explicit v1 rollback and fail-closed v6 retirement still in place.
- The current TypeScript, production build, 37-file / 171-test, memory-mirror, deterministic v1.1, and route-shell
  performance checks pass. No authenticated Chrome pass or owner-key generation smoke has been claimed.
- The tracked product branch contains no v5/v6 experiment corpus. The three verified local v5 copies were moved to a
  named quarantine outside the repository; no v5 files remain untracked in the working tree.
- Continue with the authenticated route/console and render-bound pass described in `PLAN.md` and
  `docs/dev/handoffs/city-cost-v1-1.md`.

## Stop rules

- Do not access, score, freeze, replace, or collect a holdout.
- Do not modify the live 121-city CSV or bulk-migrate existing cities.
- Do not refit accommodation, collect a new panel, run a lived-spending benchmark, or resurrect v6/v6.1.
- Do not put provider API keys in the repository, logs, database, or agent output.
- Fail closed on invalid anchors, unsupported countries, missing FX, provider failure, and partial persistence.
- Treat the keyed three-city smoke as operational validation only; it is not an accuracy claim.

## Completion sequence

1. Complete the authenticated read-only route/console and initial `/plan` and `/dataset` render-bound pass. Do not
   inspect browser storage or provider keys.
2. Keep v1.1 as the new-city default and retain explicit v1 rollback; rerun the full baseline after implementation
   changes.
3. Run the Tottori, Toowoomba, and Brno owner-key smoke only after the authenticated runtime/UI pass. Treat it as
   operational validation, not an accuracy benchmark, and do not claim a pass until it is actually run.
4. Preserve the archived v6 branch, tag, and historical log entries; do not migrate the existing CSV without a separate
   decision.
