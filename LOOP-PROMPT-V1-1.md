# City Cost v1.1 loop

Read `PLAN.md` and `docs/dev/handoffs/city-cost-v1-1.md` before acting. Continue from the first incomplete checklist
phase. `PLAN.md` is the progress artifact: update it when a task starts or finishes and before every commit or push;
keep one phase in progress and name one exact next action.

## Target

Ship the simple v1.1 path for newly generated cities while preserving v1 rollback. Keep all 19 planner tiers. The
model returns the existing ten USD anchors plus a recent official RBA FX observation in one web-enabled call;
deterministic server code validates/inverts FX and applies the exact v1 formulas. Persist methodology, provider/model,
reasoning, prompt/formula, FX,
anchors, request context, and confidence provenance without inventing source grades or intervals.

## Current checkpoint - 26 August 2026

- The cleanup began with `main` and `origin/main` at `40f3c65`; v1.1 is already the default for newly generated cities,
  with explicit v1 rollback and fail-closed v6 retirement still in place.
- The authenticated Chrome owner-key smoke passed for Tottori, Toowoomba, and Brno with OpenAI `gpt-5.6-luna`,
  reasoning `max`, one web-enabled generation call per city, deterministic v1 formulas, and RBA FX dated 25 August.
- The tracked product branch contains no v5/v6 experiment corpus. The three verified local v5 copies were moved to a
  named quarantine outside the repository; no v5 files remain untracked in the working tree.
- Continue with the remaining planner, saved-plan, tracking, settings, and failure-state workflows described in
  `PLAN.md` after committing the verified generation checkpoint.

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
3. Preserve the completed Tottori, Toowoomba, and Brno owner-key smoke as operational validation, not an accuracy
   benchmark; rerun it only when a relevant generation boundary changes.
4. Preserve the archived v6 branch, tag, and historical log entries; do not migrate the existing CSV without a separate
   decision.
