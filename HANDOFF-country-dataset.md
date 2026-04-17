# Handoff to Codex - Wanderledger Country Dataset Workstream

This handoff replaces the earlier Phase 3-oriented version. Phase 4 is now complete, and the next meaningful chunk is Phase 5 validation/tests.

## Current branch

- Branch: `feat/country-dataset`
- Base: `main`
- Plan file: `PLAN-country-dataset.md`
- Current state: Phase 4 code and docs are complete locally and verified; commit the work on this branch before starting Phase 5

## Phase status

From `PLAN-country-dataset.md`:

- [x] Phase 0 - Branch + plan doc
- [x] Phase 1 - Canonical dataset files + generator scaffold
- [x] Phase 2 - Runtime resolver refactor onto canonical dataset
- [x] Phase 3 - `/dataset` country creation simplified
- [x] Phase 4 - Planner and server-side country creation paths reuse canonical resolver
- [ ] Phase 5 - Validation/tests for dataset integrity and alias resolution
- [ ] Phase 6 - Docs, PR review, and merge readiness

## What Phase 4 changed

Phase 4 finished the main architectural goal of this workstream: all country creation paths now resolve through the same canonical-country helper rather than duplicating their own currency/region logic.

### Shared canonical helper

`src/lib/country-metadata.ts` now owns the reusable country-creation logic:

- `resolveCountryCreationDefaults(...)`
- `findExistingCountryForCanonical(...)`
- `CountryMetadataResolutionError`

These helpers do three important things:

1. Resolve a country from canonical id or name using the repo-owned dataset.
2. Build an insert-ready DB shape with canonical `id`, `name`, `currencyCode`, and `region`.
3. Match existing DB country rows back onto canonical countries so legacy rows are reused instead of duplicated.

That legacy-row matching matters because older local DBs may already contain country ids/names that are equivalent to the canonical dataset even if the exact stored id differs.

### Server/API changes

`POST /api/countries` now:

- resolves through the shared helper
- rejects unknown countries with a canonical-dataset error
- detects duplicates by canonical equivalence, not just raw id equality

`POST /api/cities` now:

- resolves the requested country through the same helper
- reuses an equivalent existing country row when possible
- auto-creates the canonical country row only when needed
- still preserves the important ordering where city duplicate validation happens before the country insert

### Planner new-city flow changes

`src/lib/planner-city-resolution.ts` was refactored so planner-side city creation no longer asks the LLM to supply country metadata like currency code or region.

The planner flow now:

- asks the LLM only for city name, country name, and confidence notes
- resolves currency/region server-side from the canonical dataset
- reuses an equivalent existing country row when available
- creates the canonical country row when missing
- backfills missing region on existing country rows when canonical metadata is available
- fails clearly if the requested country is not in the canonical dataset

The route `src/app/api/itinerary/legs/create-with-city/route.ts` inherits this behavior through `resolveOrCreatePlannerCity(...)`.

### Snapshot import changes

`src/lib/snapshot-import.ts` and `src/lib/resolve-missing-cities.ts` were simplified:

- missing-city resolutions no longer carry `countryCurrencyCode`
- snapshot import no longer accepts manual currency/region metadata for countries
- country resolution is canonical-only
- unknown countries fail with a dataset-regeneration message

### Planner UI changes

`src/app/plan/page.tsx` now treats missing-city resolution as canonical-country selection, not country creation.

The import dialog now:

- asks for city id, city name, and canonical country only
- offers a picker over the canonical dataset
- shows a country preview with canonical id, currency, region, and whether an existing library row will be reused or auto-created during import
- removes the old manual new-country fields and all freeform currency entry

## Verification completed for Phase 4

Verified locally on April 17, 2026:

- `npx tsc --noEmit`
- `npm run build`

Notes:

- `npx tsc --noEmit` initially failed because `.next/types` was stale/missing for some app routes. Re-running it after `npm run build` passed cleanly.
- The existing `/api/export` dynamic-server warning during `next build` is still expected and is unrelated to this feature.

## Files changed in Phase 4

- `src/lib/country-metadata.ts`
- `src/app/api/countries/route.ts`
- `src/app/api/cities/route.ts`
- `src/lib/planner-city-resolution.ts`
- `src/lib/snapshot-import.ts`
- `src/lib/resolve-missing-cities.ts`
- `src/app/plan/page.tsx`
- `PLAN-country-dataset.md`
- `HANDOFF-country-dataset.md`

## Important constraints to preserve

1. Do not reintroduce a standalone Add Country admin flow.
2. Do not reintroduce freeform currency entry anywhere in planner, snapshot import, or dataset admin.
3. Keep country lookup deterministic: canonical id/name/alias/ISO only, no fuzzy matching.
4. Keep country metadata repo-owned. If a country is missing, update the dataset source rather than inventing metadata in the UI.
5. Preserve the city-before-country-insert duplicate-check ordering in `POST /api/cities`.

## Recommended Phase 5 scope

Phase 5 should add validation/tests around the canonical dataset and resolver behavior.

### Suggested work

- Add dataset integrity tests for:
  - unique country ids
  - unique canonical names
  - alias collisions
  - valid/non-empty currency codes
  - valid app region values
- Add resolver tests for:
  - canonical-name lookup
  - alias lookup
  - id lookup
  - normalization behavior
  - expected failure for unknown countries
- Add API-level tests for:
  - `POST /api/countries`
  - `POST /api/cities`
  - duplicate handling via canonical equivalence where practical

### Likely files for Phase 5

- `src/lib/country-metadata.ts`
- `src/lib/data/country-metadata.generated.json`
- `src/lib/data/country-metadata.overrides.json`
- existing test directories and config
- `PLAN-country-dataset.md`

## Useful commands

```bash
git status --short
git log --oneline main..HEAD
npx tsc --noEmit
npm run build
```

