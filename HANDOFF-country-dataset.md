# Handoff to Codex - Wanderledger Country Dataset Workstream

This document supersedes the earlier revision of `HANDOFF-country-dataset.md` (commit `ff88f4c`). Phase 3 is now complete and the workstream has evolved in a way the original plan did not anticipate; this handoff captures the new shape so Codex can resume cleanly.

## Current branch

- Branch: `feat/country-dataset`
- Base: `main`
- Current HEAD: `b7ba68a` (`feat(dataset): auto-create country from canonical dataset on city add`)
- PR: #4 `docs(plan): add canonical country dataset implementation plan` (draft)
- Plan file: `PLAN-country-dataset.md`

## Why this workstream exists

Unchanged from the previous handoff. Summary:

- Country currency and region are deterministic metadata, not LLM output
- The repo owns a canonical country dataset
- Runtime country inference must not depend on live network calls
- Admins should not have to enter currency codes by hand
- Unknown countries should fail clearly and force a dataset update rather than freeform metadata entry

## What has landed on this branch since the last handoff

Commits on `feat/country-dataset` (newest first):

| SHA | Scope | Summary |
| --- | --- | --- |
| `b7ba68a` | Expanded Phase 3 | Cities route auto-creates country rows from canonical dataset; `/dataset` Add City dropdown now enumerates all 245 canonical countries; Add Country dialog and inline Create Country button removed entirely |
| `bb59cbf` | Phase 3 follow-up | Removed the top-level Add Country button (intermediate step before the full auto-create flow) |
| `6e93c19` | Phase 3 base | `POST /api/countries` strict-schema refactor that rejects freeform currency and unknown countries; initial name-first `/dataset` Add Country dialog |
| `ff88f4c` | Handoff refresh | Old handoff doc refresh (now superseded by this file) |
| `549d6ed` | Phase 2 | Runtime resolver refactor onto canonical dataset |
| `fccacc1` | Phase 1 | Canonical dataset + generator scaffold |
| `e253ef0` | Phase 0 | Plan doc |

## Current phase status

From `PLAN-country-dataset.md`:

- [x] Phase 0 - Branch + plan doc
- [x] Phase 1 - Canonical dataset files + generator scaffold
- [x] Phase 2 - Runtime resolver refactor onto canonical dataset
- [x] Phase 3 - `/dataset` country creation simplified (shipped a stronger UX than originally planned - see below)
- [ ] Phase 4 - Planner and server-side country creation paths reuse canonical resolver
- [ ] Phase 5 - Validation/tests for dataset integrity and alias resolution
- [ ] Phase 6 - Docs, PR review, and merge readiness

## How Phase 3 differs from the original plan

The original Phase 3 spec was "simplify `/dataset` country creation to name-first". The first commit (`6e93c19`) implemented exactly that. During user testing the user rejected the concept of a standalone Add Country admin step entirely:

> "The whole point of having a complete country list is to NOT have to create a country. It should all happen automatically."

So Phase 3 ended up shipping a different and stronger final state, captured in `b7ba68a`:

1. **`/dataset` Add Country UI removed entirely.**
   - The top-level "Add Country" button is gone.
   - The Add Country dialog JSX, state, derivations, and `handleAddCountry` are gone.
   - The inline "Create Country" subflow inside Add City is gone.

2. **Add City country dropdown now enumerates all 245 canonical countries.**
   - Sourced from a new `KNOWN_COUNTRIES` export in `src/lib/country-metadata.ts` (readonly, pre-sorted).
   - Any city anywhere in the world can be added in one step.

3. **`POST /api/cities` auto-creates the country row when missing.**
   - Resolves `countryId` against the canonical dataset.
   - Rejects (400) only if the id is not in the canonical dataset at all.
   - Auto-inserts the `countries` row from canonical metadata before inserting the city.
   - Country insert is ordered AFTER city-level duplicate validation so no orphan country rows can be left behind if the city insert fails.

4. **`POST /api/countries` still exists and is still hardened.**
   - Strict Zod schema rejects any extra fields (no `currencyCode` input).
   - Rejects unknown countries with a clear message pointing at the regeneration command.
   - No UI in the app currently calls this route, but it is kept intact for completeness and is the right surface for Phase 4 planner/snapshot flows if they need an explicit country-only creation path.

## Design principle worth carrying forward

The user explicitly framed the new direction as a general principle: **when a repo-owned canonical dataset covers an entity, the user-facing pickers must enumerate the canonical dataset, and any DB row creation must be a transparent side effect of the primary action.** There should never be a separate admin "create row" step for entities that are already fully defined in canonical repo data.

This principle should guide Phase 4:

- Planner new-city flow should reference the canonical country set directly.
- Snapshot-import missing-country resolution should not prompt the user to "create" a country it could auto-resolve from the canonical dataset.

## What Phase 4 should do

### Scope

- Unify every country-creation path so it routes through the same canonical resolver.
- Extract a shared helper so the pattern used in `POST /api/cities` (line by line: resolve canonical, auto-insert if missing, return canonical ids) is reused rather than re-implemented per route.
- Rewire any planner or snapshot-import UI that still has user-facing "create missing country" steps so the canonical list is available directly.

### Likely files

- `src/lib/country-metadata.ts` (add `resolveCountryCreationDefaults` or similar shared helper)
- `src/app/api/cities/route.ts` (already uses the pattern; should call the shared helper)
- `src/app/api/itinerary/legs/create-with-city/route.ts` (planner-side new-city server path; per CLAUDE.md this already checks DB first, canonicalizes, creates rows - but needs to reuse the shared helper instead of reimplementing)
- `src/lib/planner-city-resolution.ts`
- `src/lib/resolve-missing-cities.ts` (snapshot import)
- `src/app/plan/page.tsx` (check whether the new-city dialog / missing-country resolver still exposes UI for country creation that should be removed or simplified)

### Suggested helper shape

```ts
export function resolveCountryCreationDefaults(input: {
  name?: string;
  id?: string;
}): {
  canonical: CountryMetadata;
  dbInsert: typeof countries.$inferInsert;
} | null;
```

Returning both the canonical row and an insert-ready shape keeps the call sites thin.

### Phase 4 verification

- Snapshot import missing-country flow no longer prompts for manual country creation.
- Planner-side new-city flow uses the same canonical source as `/dataset`.
- Every country insert in the codebase resolves through one helper.
- `npm run build` and `npx tsc --noEmit` pass.

## Verified state so far

- `npx tsc --noEmit` passes at HEAD
- `npm run build` passes at HEAD
- `/dataset` bundle size dropped from ~10.7 kB to ~9.7 kB after the Add Country UI removal
- The known `/api/export` dynamic-server warning still appears during `next build`; that is pre-existing and documented in `CLAUDE.md`

No test suite was added in this phase (that is Phase 5).

## Key files for Codex

- `PLAN-country-dataset.md`
- `HANDOFF-country-dataset.md` (this file)
- `src/lib/country-metadata.ts` (now exports `KNOWN_COUNTRIES`)
- `src/lib/data/country-metadata.generated.json` (245 rows)
- `src/lib/data/country-metadata.overrides.json`
- `scripts/generate-country-metadata.mjs`
- `src/app/api/countries/route.ts` (hardened, strict schema)
- `src/app/api/cities/route.ts` (auto-creates country from canonical)
- `src/app/api/itinerary/legs/create-with-city/route.ts` (planner new-city; Phase 4 target)
- `src/lib/planner-city-resolution.ts` (Phase 4 target)
- `src/lib/resolve-missing-cities.ts` (Phase 4 target)
- `src/app/dataset/page.tsx` (Add Country UI removed; dropdown uses canonical)
- `src/app/plan/page.tsx` (Phase 4 target - check missing-country resolver UI)

## Important cautions

1. **Do not reintroduce an Add Country admin step.**
   The user explicitly rejected this. Countries are picked from the canonical list; DB rows appear as a side effect of city or leg creation.

2. **Do not reintroduce freeform currency entry.**
   Currency is canonical metadata, not user input.

3. **Keep runtime lookup deterministic.**
   No fuzzy matching. Exact normalized alias/name/id/ISO matching only via `findKnownCountryMetadata`.

4. **Treat the generated JSON as committed output, not hand-maintained truth.**
   If metadata needs changing, prefer the overrides layer or generator logic.

5. **Keep ASCII-safe output in generated assets.**
   The user has previously seen mojibake-like rendering in docs; the generator explicitly strips non-ASCII to avoid this.

6. **Auto-create ordering matters.**
   In `POST /api/cities`, the country insert is placed AFTER city-level duplicate checks and BEFORE the city insert. Preserve this order when extracting the shared helper so no orphan country rows can be left behind on late city-insert failure.

7. **`POST /api/countries` is intentionally orphaned from the UI.**
   It is still hardened and still correct; keep it as the canonical-only creation endpoint for any future server-side flow that needs it. Do not delete it just because nothing calls it right now.

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

At the time this handoff was written, there are no pending local changes. All Phase 3 work is committed and pushed to `origin/feat/country-dataset`.

This file itself should be committed and pushed so future resumes have the correct context.
