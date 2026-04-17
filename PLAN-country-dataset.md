# Canonical Country Dataset - Implementation Plan

> **Branch**: `feat/country-dataset` off `main`
> **PR target**: `main`
> **Status**: IN PROGRESS -- Phase 3 complete (shipped a stronger UX than originally scoped; see `HANDOFF-country-dataset.md`)
> **Related**: CLAUDE.md "Settings / Admin UX" follow-up and country metadata canonicalization

---

## Context

Wanderledger currently resolves country currency codes and app regions from hand-maintained constant maps in `src/lib/country-metadata.ts`. That works for the current seeded countries, but it has two structural problems:

1. **The source of truth is incomplete and code-shaped.** Adding a country means editing helper code rather than updating a canonical data asset.
2. **Country creation still has metadata gaps.** We want admins to create missing countries without typing currency codes, while keeping the result deterministic and auditable.

This feature introduces a canonical country dataset in the repo, generated from authoritative external standards and merged with a small local overrides layer for app-specific choices such as aliases and app-region mapping.

### Design anchors

- **Country metadata is deterministic, not LLM-owned.** Currency code and region should not come from the city-cost prompt.
- **The repo owns the final canonical dataset.** Runtime country inference must not depend on live network calls.
- **Generated base + explicit overrides.** Upstream standards provide the baseline; the app keeps a narrow local override file for aliases and product-specific adjustments.
- **Country creation should not require currency input.** Admins provide a country name and optionally an explicit id; the rest is inferred from the canonical dataset.
- **Unknown countries should fail loudly.** If a country cannot be resolved from the canonical dataset, the fix is to update the dataset source, not to type arbitrary metadata into the UI.

---

## Checkpoints

- [x] **Phase 0** - Branch + plan doc
- [x] **Phase 1** - Canonical dataset files + generator scaffold
- [x] **Phase 2** - Runtime resolver refactor onto canonical dataset
- [x] **Phase 3** - `/dataset` country creation simplified (shipped as full auto-create from canonical list, not just name-first form)
- [ ] **Phase 4** - Planner and server-side country creation paths reuse canonical resolver
- [ ] **Phase 5** - Validation/tests for dataset integrity and alias resolution
- [ ] **Phase 6** - Docs, PR review, and merge readiness

Each phase should end with verification and its own commit on `feat/country-dataset`.

---

## Phase 1: Canonical Dataset Files + Generator Scaffold

### 1a. Canonical file layout

Create a small data stack under `src/lib/data/`:

- `country-metadata.generated.json`
- `country-metadata.overrides.json`
- optional raw/bootstrap inputs under `scripts/data/` or `seed-data/` if needed for generation

Recommended generated row shape:

```json
{
  "id": "united-kingdom",
  "name": "United Kingdom",
  "aliases": ["UK", "Britain", "Great Britain"],
  "currencyCode": "GBP",
  "region": "europe",
  "iso2": "GB",
  "iso3": "GBR",
  "source": "generated"
}
```

### 1b. Generator script

Create a script that can build the generated dataset from authoritative sources:

- UN M49 / territory list for country naming and ISO codes
- CLDR supplemental territory/currency and alias data
- ISO 4217 validation for currency codes

The generator output should be committed into the repo rather than fetched at runtime.

Suggested script:

```bash
npm run country-metadata:generate
```

### 1c. Overrides layer

Create `country-metadata.overrides.json` for:

- app-specific aliases
- rare manual corrections
- inclusion/exclusion decisions
- app-region overrides where the raw upstream region tree does not map cleanly to Wanderledger's buckets

The generator should merge:

```text
upstream-derived base -> app overrides -> final generated canonical file
```

### Phase 1 verification

- Generator runs locally and produces a stable JSON file
- Generated rows contain `id`, `name`, `currencyCode`, and `region`
- No runtime code depends on network access to read country metadata

**Commit**: `chore(country-data): add canonical dataset scaffold and generator`

---

## Phase 2: Runtime Resolver Refactor

### 2a. Refactor `src/lib/country-metadata.ts`

Replace the current hardcoded maps with a resolver layer backed by the canonical dataset files.

Exports should include:

```ts
export function findKnownCountryMetadata(input: string): CountryMetadata | null
export function findKnownCountryCurrencyCode(input: string): string | null
export function findKnownCountryRegion(input: string): string | null
export function findKnownCountryById(id: string): CountryMetadata | null
export function slugifyId(value: string): string
```

### 2b. Matching strategy

Matching should support:

- canonical country name
- explicit aliases
- normalized slug match
- optionally ISO2 / ISO3 lookup if useful internally

Avoid fuzzy or probabilistic matching at runtime. Keep it deterministic.

### 2c. Preserve current call sites

Existing code already imports:

- `findKnownCountryCurrencyCode`
- `findKnownCountryRegion`
- `slugifyId`

Keep these exports stable so the refactor can land with minimal UI churn.

### Phase 2 verification

- Existing code paths still compile without broad call-site rewrites
- Current seeded countries resolve exactly as before
- Alias lookups such as `UK`, `USA`, and `Czechia` resolve cleanly

**Commit**: `refactor(country-data): back runtime metadata with canonical dataset`

---

## Phase 3: `/dataset` Country Creation Simplification

### 3a. Remove currency-code responsibility from the admin UX

Modify `/dataset` country creation so the admin provides:

- country name
- optional explicit id
- optional region override only if needed

Currency code should be inferred automatically from the canonical dataset and shown as a preview, not entered manually.

### 3b. API behavior

Update `POST /api/countries` so it:

1. normalizes the country name
2. resolves canonical metadata from the dataset
3. uses canonical `currencyCode`
4. uses canonical or overridden app `region`
5. rejects creation if the country is not found in the canonical dataset

### 3c. UX for unknown countries

If a country is unknown:

- block creation
- show a clear message that the canonical country dataset must be updated first
- do not fall back to freeform currency input

### Phase 3 verification

- Known country creation works with no currency input
- Unknown country creation fails with a clear action message
- Duplicate-country handling still works

**Commit**: `feat(dataset): infer country currency from canonical dataset`

---

## Phase 4: Planner + Server-Side Reuse

### 4a. Missing-country resolution in planner flows

Update planner and snapshot-import country creation paths to use the same canonical resolver:

- `src/app/plan/page.tsx`
- server-side missing-country creation helpers
- planner-side "create with city" route

### 4b. Single inference path

All country creation should use one shared helper rather than duplicating:

- name normalization
- id inference
- currency resolution
- region resolution

Suggested helper:

```ts
export function resolveCountryCreationDefaults(input: {
  name: string
  id?: string
}): ResolvedCountryMetadata | null
```

### Phase 4 verification

- Snapshot import missing-country flow no longer needs manual currency entry
- Planner-side country creation uses the same canonical metadata as `/dataset`
- No country-creation path bypasses the canonical resolver

**Commit**: `refactor(country-data): reuse canonical resolver across planner flows`

---

## Phase 5: Validation + Tests

### 5a. Dataset integrity tests

Add tests for:

- unique `id`
- unique canonical `name`
- alias collisions
- every row has `currencyCode`
- every row has a valid app `region`

### 5b. Resolver tests

Test cases should include:

- canonical-name lookup
- alias lookup
- id lookup
- normalization behavior
- expected failures for unknown countries

### 5c. API tests

At minimum:

- `POST /api/countries` infers canonical metadata for a known country
- unknown country returns a clear 400
- duplicate country still returns 409

### Phase 5 verification

- `npm run build` passes
- relevant unit tests pass
- dataset integrity test catches collisions before bad data reaches runtime

**Commit**: `test(country-data): validate canonical country dataset and resolver`

---

## Phase 6: Documentation + Merge Readiness

### 6a. Documentation

Update:

- `CLAUDE.md`
- `AGENTS.md`
- this plan file as milestones complete

Document:

- canonical country dataset location
- how to regenerate it
- how overrides work
- that country creation no longer relies on typed currency codes

### 6b. Merge readiness

- push `feat/country-dataset`
- open PR against `main`
- include plan summary and implementation milestones in PR body
- confirm no unrelated files were added (especially local handoff notes)

### Phase 6 verification

- `npm run docs:check-memory` passes
- PR is open and references `PLAN-country-dataset.md`

**Commit**: `docs(country-data): document canonical dataset workflow`

---

## Source-Of-Truth Maintenance Options

### Option A - Generated base + overrides (recommended)

- `country-metadata.generated.json` is machine-built from authoritative sources
- `country-metadata.overrides.json` contains explicit app-level adjustments

This is the preferred steady-state model.

### Option B - Manual direct edits to the canonical file

Allowed only as an emergency escape hatch.

If used:

- follow up by moving the change into the generator or overrides layer
- avoid silently growing hand-edited drift in the generated file

### Option C - Later admin import/export tooling

Possible future enhancement:

- export the canonical dataset
- edit overrides through a controlled admin workflow
- regenerate the final resolved file

This is out of scope for the first implementation.

---

## Key Files

- `PLAN-country-dataset.md`
- `src/lib/country-metadata.ts`
- `src/app/api/countries/route.ts`
- `src/app/dataset/page.tsx`
- `src/app/plan/page.tsx`
- `src/lib/planner-city-resolution.ts`
- `src/lib/resolve-missing-cities.ts`
- `CLAUDE.md`
- `AGENTS.md`

---

## Architecture Notes

- **Why not LLM prompts for currency codes?** Because currency is deterministic country metadata, not estimated city-cost output.
- **Why not runtime API fetches?** Country inference should remain stable offline and during deployment; runtime network dependence adds fragility for no real product gain.
- **Why keep overrides?** App regions and UX aliases are product decisions, not pure standards data.
- **Why block unknown countries?** It keeps the metadata layer auditable and prevents ad hoc low-quality country rows from creeping into the planner.
