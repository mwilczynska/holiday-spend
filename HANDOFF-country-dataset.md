# Handoff to Claude Code - Wanderledger Country Dataset Workstream

This document supersedes the old `HANDOFF-codex-phase-9.md`, which was for the native-accounts feature on a different branch.

## Current branch

- Branch: `feat/country-dataset`
- Base: `main`
- Current HEAD: `549d6ed` (`refactor(country-data): back runtime metadata with canonical dataset`)
- PR: #4 `docs(plan): add canonical country dataset implementation plan` (draft)
- Plan file: `PLAN-country-dataset.md`

## Why this workstream exists

The user wants to remove manual currency-code entry from country creation flows.

They explicitly chose the "canonical country dataset" approach:

- country currency and region are deterministic metadata, not LLM output
- the repo should own a canonical country dataset
- runtime country inference must not depend on live network calls
- admins should create countries by name, with currency inferred automatically
- unknown countries should fail clearly and force a dataset update rather than freeform metadata entry

This feature is the implementation of that decision.

## Important context since the old handoff

The old handoff file is no longer the right restart point.

Since then:

- the native-accounts work it described was completed and merged separately
- the app continued evolving around dataset/settings/methodology flows
- a new dedicated workstream was started for automatic country metadata inference
- this branch and plan are now about canonical country metadata, not auth

If Claude resumes from here, it should ignore the old Phase 9 native-auth instructions and continue from `PLAN-country-dataset.md`.

## What has landed on this branch

Commits on `feat/country-dataset`:

| SHA | Scope | Summary |
| --- | --- | --- |
| `e253ef0` | plan/setup | Added `PLAN-country-dataset.md` and opened the new workstream |
| `fccacc1` | Phase 1 | Added generator scaffold, overrides file, generated canonical dataset, and npm script |
| `549d6ed` | Phase 2 | Replaced hardcoded runtime country maps with resolver logic backed by the canonical dataset |

## Current phase status

From `PLAN-country-dataset.md`:

- [x] Phase 0 - Branch + plan doc
- [x] Phase 1 - Canonical dataset files + generator scaffold
- [x] Phase 2 - Runtime resolver refactor onto canonical dataset
- [ ] Phase 3 - `/dataset` country creation simplified to name-first flow
- [ ] Phase 4 - Planner and server-side country creation paths reuse canonical resolver
- [ ] Phase 5 - Validation/tests for dataset integrity and alias resolution
- [ ] Phase 6 - Docs, PR review, and merge readiness

## What Phase 1 actually changed

New generator/data files:

- `scripts/generate-country-metadata.mjs`
- `src/lib/data/country-metadata.overrides.json`
- `src/lib/data/country-metadata.generated.json`

`package.json` now has:

```json
"country-metadata:generate": "node scripts/generate-country-metadata.mjs"
```

Implementation details:

- generator uses `world-countries` as the upstream source package
- output is committed to the repo; no runtime fetching
- generated rows are ASCII-safe to avoid the mojibake/rendering problems seen elsewhere
- generator maps world regions/subregions into Wanderledger app regions
- app-specific overrides are applied for cases where the app intentionally differs from upstream defaults

Important overrides currently encoded:

- Cambodia -> `USD`
- Cuba -> `CUP`
- Micronesia -> `USD`
- Egypt region -> `middle_east`
- Georgia region -> `europe`
- Czechia canonicalized to app-facing `Czech Republic`
- Turkiye/Turkey compatibility

Generator output shape:

- `id`
- `name`
- `aliases`
- `currencyCode`
- `region`
- `iso2`
- `iso3`
- `source`

Current generated dataset size:

- 245 rows

## What Phase 2 actually changed

`src/lib/country-metadata.ts` no longer hardcodes `COUNTRY_CURRENCY_CODES` and `COUNTRY_REGIONS` as the source of truth.

Instead it now:

- imports `src/lib/data/country-metadata.generated.json`
- validates rows on load
- builds deterministic lookup maps
- supports lookup by:
  - canonical name
  - alias
  - canonical `id`
  - `iso2`
  - `iso3`
- preserves the existing public helpers used throughout the app

Exports now available:

- `findKnownCountryMetadata`
- `findKnownCountryById`
- `findKnownCountryCurrencyCode`
- `findKnownCountryRegion`
- `getCountryCurrencyCode`
- `normalizeRegionLabel`
- `slugifyId`
- `COUNTRY_CURRENCY_CODES`
- `COUNTRY_REGIONS`
- `APP_REGION_VALUES`

The compatibility constraint for Phase 2 was preserved: current callers did not need to be rewritten yet.

## Verified state so far

Phase 1 verification:

- `npm run country-metadata:generate` passed
- generated dataset successfully built at `src/lib/data/country-metadata.generated.json`
- generated data matched all current app-used country currency/region expectations

Phase 2 verification:

- `npx tsc --noEmit` passed
- `npm run build` passed
- deterministic lookup smoke checks confirmed expected results for:
  - `UK`
  - `USA`
  - `Czechia`
  - `Turkiye`
  - `UAE`
  - `Georgia`
  - `Egypt`

Existing build note still applies:

- `/api/export` shows the known dynamic-server warning because it uses request headers/url

## Key files for the next person

- `PLAN-country-dataset.md`
- `HANDOFF-country-dataset.md`
- `src/lib/country-metadata.ts`
- `src/lib/data/country-metadata.generated.json`
- `src/lib/data/country-metadata.overrides.json`
- `scripts/generate-country-metadata.mjs`
- `src/app/api/countries/route.ts`
- `src/app/dataset/page.tsx`
- `src/app/plan/page.tsx`
- `src/lib/planner-city-resolution.ts`
- `src/lib/resolve-missing-cities.ts`

## The next task: Phase 3

Phase 3 is the next logical step and is not started yet.

Scope:

- simplify `/dataset` country creation to name-first flow
- remove manual currency-code responsibility from the admin UI
- infer currency from canonical country metadata
- keep region as canonical by default, with override only where needed
- reject unknown countries instead of falling back to manual currency entry

Likely files:

- `src/app/dataset/page.tsx`
- `src/app/api/countries/route.ts`

Likely implementation shape:

1. UI:
   - remove freeform currency input from the create-country form
   - show inferred currency as preview text
   - optionally allow region override, but default to canonical region
   - show a clear error/help message when the country is not in the canonical dataset

2. API:
   - resolve canonical metadata from `name`
   - use canonical `currencyCode`
   - use canonical region unless the user explicitly overrides region
   - return a clear `400` for unknown country names
   - keep duplicate-country checks in place

3. Verification:
   - known country creation succeeds without manual currency entry
   - unknown country creation fails clearly
   - duplicate by id / duplicate by normalized name still behave correctly

## After Phase 3

Phase 4 should unify planner-side country creation with the same canonical resolver.

That likely means shared helper extraction rather than keeping similar logic in:

- `/dataset`
- planner missing-country creation
- snapshot import country creation
- planner "create with city" server path

The plan already suggests a shared resolver such as:

```ts
resolveCountryCreationDefaults({ name, id? })
```

That is still the right direction.

## Important cautions

1. Do not reintroduce freeform currency as the fallback path.
   The whole point of this workstream is to keep currency deterministic and repo-owned.

2. Keep runtime lookup deterministic.
   No fuzzy matching. Exact normalized alias/name/id/ISO matching only.

3. Treat the generated JSON as committed output, not hand-maintained truth.
   If metadata needs changing, prefer the overrides layer or generator logic.

4. Keep ASCII-safe output in generated assets.
   This was added specifically because the user previously saw mojibake-like rendering in docs.

5. There is still an unrelated local handoff history story in the repo conversation.
   This file is now the correct restart point for Claude Code.

## Useful commands

```bash
git log --oneline main..HEAD
cat PLAN-country-dataset.md
cat HANDOFF-country-dataset.md
npm run country-metadata:generate
npx tsc --noEmit
npm run build
```

## Working tree note

At the time this handoff was rewritten, there were no tracked local changes pending.

This file itself should be committed and pushed so future resumes have the correct context.
