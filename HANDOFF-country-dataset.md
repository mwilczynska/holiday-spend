# Handoff to Codex - Wanderledger Country Dataset Workstream

This handoff supersedes the earlier Phase 4 version. Phase 5 is now complete, and the next step is Phase 6 docs/merge-readiness work.

## Current branch

- Branch: `feat/country-dataset`
- Base: `main`
- Plan file: `PLAN-country-dataset.md`
- Current local state: Phase 5 code, tests, and docs are complete locally and verified; commit this checkpoint before starting Phase 6

## Phase status

From `PLAN-country-dataset.md`:

- [x] Phase 0 - Branch + plan doc
- [x] Phase 1 - Canonical dataset files + generator scaffold
- [x] Phase 2 - Runtime resolver refactor onto canonical dataset
- [x] Phase 3 - `/dataset` country creation simplified
- [x] Phase 4 - Planner and server-side country creation paths reuse canonical resolver
- [x] Phase 5 - Validation/tests for dataset integrity and alias resolution
- [ ] Phase 6 - Docs, PR review, and merge readiness

## What Phase 5 added

Phase 5 added automated coverage for the canonical dataset itself, the resolver layer, and the route handlers that create/reuse country rows.

### Dataset and resolver tests

New file:

- `src/lib/country-metadata.test.ts`

Coverage added:

- unique canonical `id`
- unique canonical `name`
- no conflicting normalized lookup keys across ids, names, ISO codes, and aliases
- valid/non-empty 3-letter `currencyCode`
- valid app `region`
- alias and ISO resolution for known cases such as `UK`, `USA`, `Czechia`, and `AE`
- `resolveCountryCreationDefaults(...)` success path
- `resolveCountryCreationDefaults(...)` null result for unknown countries
- `CountryMetadataResolutionError` on conflicting id/name inputs
- `findExistingCountryForCanonical(...)` reusing a legacy-equivalent existing row

### Route tests

New file:

- `src/lib/country-routes.test.ts`

Coverage added against the real route handlers with a temp SQLite DB:

- `POST /api/countries` infers canonical metadata from a known alias
- `POST /api/countries` rejects duplicates even when the existing DB row uses a legacy-equivalent id
- `POST /api/cities` auto-creates a missing canonical country row
- `POST /api/cities` reuses an equivalent existing country row instead of duplicating it
- `POST /api/cities` checks duplicate city ids before inserting a new canonical country row

### Temp DB harness note

The route tests create `countries` and `cities` tables explicitly inside the temp SQLite DB before importing the route modules.

That is necessary because `src/db/index.ts` currently performs runtime backfill/bootstrap for many tables, but it does not fully create `countries`/`cities` from scratch in an empty temp database. The app works in normal seeded/dev usage; this only mattered for isolated route-level tests.

## Verification completed for Phase 5

Verified locally on April 17, 2026:

- `cmd /c npx vitest run src/lib/country-metadata.test.ts src/lib/country-routes.test.ts`
- `cmd /c npm test`
- `npx tsc --noEmit`
- `npm run build`

Notes:

- Vitest needed to be run outside the sandbox in this environment because the Vite/Vitest startup step hit a Windows `spawn EPERM` under sandboxing. That was an execution-environment issue, not an app/test failure.
- The Vite output prints a non-blocking suggestion about `vite-tsconfig-paths`; no change was made in this phase.
- The existing `/api/export` dynamic-server warning during `next build` is still expected and unrelated to this feature.

## Files changed in Phase 5

- `src/lib/country-metadata.test.ts`
- `src/lib/country-routes.test.ts`
- `PLAN-country-dataset.md`
- `HANDOFF-country-dataset.md`

## Important constraints to preserve

1. Do not reintroduce a standalone Add Country admin flow.
2. Do not reintroduce freeform currency entry anywhere in planner, snapshot import, or dataset admin.
3. Keep country lookup deterministic: canonical id/name/alias/ISO only, no fuzzy matching.
4. Keep country metadata repo-owned. If a country is missing, update the dataset source rather than inventing metadata in the UI.
5. Preserve the city-before-country-insert duplicate-check ordering in `POST /api/cities`.

## Recommended Phase 6 scope

Phase 6 should finish the branch for review and merge readiness.

### Suggested work

- Update `CLAUDE.md` and `AGENTS.md` so the country-dataset workstream progress is reflected in project memory
- Review whether `README.md` or any nearby docs need a short note about canonical country metadata regeneration
- Push `feat/country-dataset`
- Refresh the PR body/description with Phase 1-5 milestones
- Do a final diff sweep for stray branch-only notes or unrelated files

### Nice-to-have checks during Phase 6

- `npm run docs:check-memory`
- `git log --oneline main..HEAD`
- confirm the PR references `PLAN-country-dataset.md`

## Useful commands

```bash
git status --short
git log --oneline main..HEAD
cmd /c npm test
npx tsc --noEmit
npm run build
```

