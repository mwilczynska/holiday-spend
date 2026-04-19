# Handoff to Claude Code - Cleanup / Simplification

This handoff covers the current state of the `feat/cleanup-simplification` branch after the first two implementation checkpoints. The branch is pushed and verified, but Phase 4 merge-readiness work is still open.

## Current branch

- Branch: `feat/cleanup-simplification`
- Base: `main`
- Plan file: `PLAN-cleanup-simplification.md`
- Current HEAD: `5f80220`

## Branch status

From `PLAN-cleanup-simplification.md`:

- [x] Phase 0 - Plan doc + cleanup inventory
- [x] Phase 1 - Seed/dataset/methodology legacy-path cleanup
- [x] Phase 2 - Migration-shim and compatibility-route cleanup
- [x] Phase 3 - Deployment/repo surface cleanup
- [ ] Phase 4 - Verification, documentation, and merge readiness

## Commits on this branch so far

- `92dc20c` - `refactor(cleanup): remove legacy compatibility paths`
- `5f80220` - `chore(cleanup): move historical dev docs out of repo root`

## What has been cleaned up

### Removed compatibility paths

- deleted `src/app/settings/cities/page.tsx`
- `/dataset` is now the only canonical city-library route
- updated the Playwright smoke test to use `/dataset` directly

### Removed one-time migration baggage

- deleted `src/lib/saved-plan-migration.ts`
- planner no longer migrates saved plans from browser `localStorage` on page load
- removed the legacy planner-group-size fallback from `app_settings` in:
  - `src/lib/user-data.ts`
  - `src/db/schema.ts`
  - `src/db/index.ts`

### Simplified seeding

- deleted `seed-data/cities.json`
- `src/db/seed.ts` no longer depends on legacy seed JSON
- seeding now uses:
  - `city_costs_app_aud.csv`
  - canonical country metadata from `src/lib/country-metadata.ts`
- city ids are derived from current slug/collision handling instead of preserved from the old seed JSON

### Removed stale estimate-era references

- removed `xoteloData` from the typed schema surface in `src/db/schema.ts`
- removed stale `xotelo` source badge handling from `src/components/cities/CostEditor.tsx`
- seed/bootstrap definitions no longer include `xotelo_data`

### Cleaned deployment / repo surface

- deleted `nginx/nginx.conf`
- `Dockerfile` no longer copies `seed-data` into the runtime image
- moved historical dev docs out of the repo root into `docs/dev/`
- moved old root `PLAN.md` to `docs/dev/PLAN-initial-spec.md`
- added `docs/dev/README.md` to explain what belongs in that folder

### Documentation already updated

- `PLAN-cleanup-simplification.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/dev/HANDOFF-dataset-methodology-split.md`

## Verification completed

Verified locally on April 18, 2026:

- `cmd /c npm test`
- `npx tsc --noEmit`
- `npm run build`
- `cmd /c npm run docs:check-memory`
- isolated seed smoke test:
  - created a temp workdir
  - ran `cmd /c npx tsx ..\\src\\db\\seed.ts`
  - result: `Seeded 58 countries and 121 cities from city_costs_app_aud.csv.`

Notes:

- `npm run build` still shows the existing `/api/export` dynamic-server warning. That is pre-existing and unrelated to this cleanup branch.
- The seed smoke test temp directory was removed afterward.

## Remaining work for Phase 4

### 1. Review the branch for any final stale references worth trimming

The branch is already in good shape, so keep this narrow. Good candidates to inspect:

- whether any remaining historical docs in root should also move to `docs/dev/`
- whether any branch docs or README notes should reference `docs/dev/HANDOFF-cleanup-simplification.md`
- whether `PLAN-saved-plans-comparison.md` should keep the old `saved-plan-migration.ts` creation step untouched as historical context, or gain a short note that the shim was later removed

Bias toward minimal churn. Do not rewrite historical plan docs unless the stale reference is actively misleading in the current branch.

### 2. Open a PR for this branch

Branch is already pushed:

- `origin/feat/cleanup-simplification`

Likely next command:

```bash
gh pr create --base main --head feat/cleanup-simplification
```

PR summary should call out:

- removed `/settings/cities`
- removed saved-plan localStorage migration
- removed legacy seed-data dependence
- removed old `xotelo` typed/UI references
- moved handoff/history docs into `docs/dev/`
- removed stale repo nginx artifact

### 3. Mark Phase 4 complete once PR is open

Update:

- `PLAN-cleanup-simplification.md`
- optionally `CLAUDE.md` / `AGENTS.md` if you want the branch memory to reflect PR-open state

Then commit the final docs-only checkpoint.

Suggested commit:

- `docs(cleanup): finalize cleanup and merge notes`

## Files most relevant for review

- `PLAN-cleanup-simplification.md`
- `src/db/seed.ts`
- `src/db/schema.ts`
- `src/db/index.ts`
- `src/lib/user-data.ts`
- `src/app/plan/page.tsx`
- `src/components/cities/CostEditor.tsx`
- `tests/playwright/ui-smoke.spec.ts`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/dev/README.md`
- `docs/dev/PLAN-initial-spec.md`
- `docs/dev/HANDOFF-country-dataset.md`
- `docs/dev/HANDOFF-dataset-methodology-split.md`

