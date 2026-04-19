# Cleanup & Simplification - Implementation Plan

> **Branch**: `feat/cleanup-simplification` off `main`
> **PR target**: `main`
> **Status**: COMPLETE -- verification passed and PR #5 is open
> **Related**: CLAUDE.md "Cleanup / Simplification"

---

## Context

Wanderledger has gone through several substantial feature migrations in sequence:

- city-cost methodology moved from the older hybrid/Xotelo framing to the current dataset + methodology split
- `/settings/cities` was replaced by `/dataset`
- planner traveller-count replaced the older split-percentage model
- saved plans moved from browser `localStorage` into the database
- native auth was added alongside Google OAuth
- canonical country metadata replaced hand-maintained country maps and manual country creation

Most of those migrations preserved compatibility and avoided risky broad deletions while the new flows were being validated. That was the right sequencing choice, but it left the repo with a growing set of compatibility shims, legacy data helpers, stale deployment-era artifacts, and code/documentation surfaces that no longer reflect the active product model cleanly.

This workstream is the deliberate cleanup pass that follows those migrations. The goal is not cosmetic churn. The goal is to remove genuinely dead or superseded paths, tighten source-of-truth boundaries, and make the codebase easier to reason about before the next feature wave.

### Design anchors

- **Protect the current product behavior first.** Cleanup should remove dead or superseded code, not destabilize active flows.
- **Prefer fewer compatibility layers over broader abstraction.** If a shim only exists for a finished migration and is no longer earning its keep, remove it.
- **Keep current source-of-truth boundaries explicit.** The canonical city dataset, canonical country dataset, current auth model, and current planner model should be obvious from the code.
- **Treat cleanup as behavior-preserving unless explicitly stated otherwise.** This is not the phase to redesign planner UX, change pricing logic, or alter deployment topology.
- **Be honest about historical data.** If a legacy schema field still exists only for audit history or back-compat, either document that clearly or remove it; avoid ambiguous half-alive fields.
- **Do not let "cleanup" become a stealth feature branch.** Transport-estimation caching, provider discovery upgrades, and new admin workflows stay out of scope unless required to unblock a removal.

### Locked-in scope decisions

- remove `/settings/cities` rather than keeping it as a compatibility redirect
- remove legacy seed-data id preservation and make seeding CSV + canonical-country driven
- remove audit-only old estimate fields from the typed/schema surface where safe
- move handoff docs out of the repo root into a dedicated docs folder

### Known concrete cleanup candidates

- `src/db/seed.ts` was still loading `seed-data/cities.json` to preserve old ids and mappings while seeding the CSV dataset
- `src/db/schema.ts` still carried legacy-looking estimate fields such as `xotelo_data`
- `src/components/cities/CostEditor.tsx` still contained source-badge styling for `xotelo`
- `src/lib/user-data.ts` still migrated planner group size from legacy `app_settings`
- `src/app/settings/cities/page.tsx` existed only as a compatibility redirect
- `src/lib/saved-plan-migration.ts` still migrated saved plans from browser localStorage into the database on first planner load
- repo-level deployment artifacts (`nginx/`, older Docker-era assumptions, and related docs) still need one explicit keep/remove decision rather than lingering indefinitely

---

## Success Criteria

By the end of this workstream:

- the active product model is reflected directly in the codebase without obvious stale parallel paths
- finished migration shims are removed rather than left as permanent baggage
- dataset/country/auth/planner source-of-truth boundaries are clearer to future contributors
- deployment artifacts and docs no longer imply multiple competing deployment approaches
- handoff docs no longer live in the repo root
- the repo passes `npm test`, `npx tsc --noEmit`, and `npm run build`
- project memory and docs clearly describe the post-cleanup state

---

## Checkpoints

- [x] **Phase 0** - Plan doc + cleanup inventory
- [x] **Phase 1** - Seed/dataset/methodology legacy-path cleanup
- [x] **Phase 2** - Migration-shim and compatibility-route cleanup
- [x] **Phase 3** - Deployment/repo surface cleanup
- [x] **Phase 4** - Verification, documentation, and merge readiness

Each phase should end with verification and its own commit on `feat/cleanup-simplification`.

---

## Phase 0: Plan Doc + Cleanup Inventory

### 0a. Create the workstream plan

Create this document and anchor the cleanup branch around a concrete removal list rather than a vague "tidy up the repo" objective.

### 0b. Inventory before deleting

Do a fast audit and sort candidates into three buckets:

1. **Safe to remove now**
2. **Keep, but document as intentional compatibility**
3. **Defer because still part of a live migration window**

At minimum, review:

- `src/db/seed.ts`
- `src/db/schema.ts`
- `src/app/settings/cities/page.tsx`
- `src/lib/user-data.ts`
- `src/lib/saved-plan-migration.ts`
- `src/components/cities/CostEditor.tsx`
- deployment-related repo files and directories:
  - `docs/ops/deployment.md`
  - `Dockerfile`
  - `docker-compose.yml`
  - `nginx/`

### 0c. Write down explicit keep/remove decisions

Decisions locked in for this implementation:

- remove the `/settings/cities` compatibility route
- remove `seed-data/cities.json` as a seeding dependency
- remove older estimate-history fields such as `xotelo_data` from the typed/schema surface where they no longer participate in active logic
- remove completed one-time migration helpers such as saved-plan migration and legacy planner-group-size migration
- move handoff docs into a dedicated docs folder

### Phase 0 verification

- plan doc exists
- cleanup candidates are grouped into keep/remove/defer buckets
- implementation scope is explicitly locked in before removal work starts

**Commit**: `docs(cleanup): add cleanup and simplification plan`

---

## Phase 1: Seed / Dataset / Methodology Cleanup

This phase cleans the city/dataset layer now that the methodology split and canonical country work are complete.

### 1a. Remove seed-script dependence on the legacy JSON dataset

**Primary target**: `src/db/seed.ts`

Current state before cleanup:

- the seed flow imported `data/reference/city_costs_app_aud.csv`
- but it also read `seed-data/cities.json` to preserve older ids, country metadata, and city-name mappings

Goal:

- remove the legacy JSON dependency entirely
- make CSV + canonical country metadata the only seed truth

Preferred outcome:

- resolve countries through `src/lib/country-metadata.ts`
- derive country ids from the canonical country dataset
- derive city ids from current slug/collision handling rather than preserving ids from the old JSON seed

### 1b. Remove stale methodology-era field references

Audit:

- `src/db/schema.ts` legacy estimate fields
- estimate rendering code
- editor/source-badge code such as `src/components/cities/CostEditor.tsx`

Goal:

- remove dead UI/source references such as `xotelo`
- remove no-longer-used audit-only estimate fields from the typed schema surface where they do not back active UI or logic

Bias:

- remove dead typed/UI references now
- avoid destructive data migration work unless it is clearly safe and worthwhile

### 1c. Clarify active estimator/source vocabulary

Make the code and labels reflect the current system:

- canonical planner city row
- methodology page
- generation history
- LLM/provider metadata
- inferred AUD/USD rate

Avoid keeping older source vocabulary that implies product paths which no longer exist.

### Phase 1 verification

- `npm test` passes
- `npx tsc --noEmit` passes
- `npm run build` passes
- seed flow still works against a fresh DB
- `/dataset` and `/estimates` still reflect the current methodology/data split cleanly

**Commit**: `refactor(cleanup): remove legacy dataset and methodology leftovers`

Implemented in:

- `92dc20c` - `refactor(cleanup): remove legacy compatibility paths`

---

## Phase 2: Migration Shims And Compatibility Route Cleanup

This phase removes finished migration helpers that are still hanging around after the new storage/routing models have settled.

### 2a. Remove one-time migration helpers that no longer justify their complexity

Primary targets:

- `src/lib/user-data.ts` legacy planner-group-size migration from `app_settings`
- `src/lib/saved-plan-migration.ts` localStorage -> DB saved-plan migration

Goal:

- keep only the paths that protect current real product behavior
- remove migration code that is now effectively permanent noise

Decision:

- both of these compatibility helpers are in scope for removal in this branch

### 2b. Remove compatibility routes rather than preserving them forever

Primary target:

- `src/app/settings/cities/page.tsx`

Decision:

- remove `/settings/cities` entirely and treat `/dataset` as the only canonical city-library route

This avoids keeping an accidental forever-route just because it was useful during the split.

### 2c. Review auth/planner compatibility leftovers

Audit for code that only exists because of earlier migrations:

- old planner split/share assumptions
- old auth fallback assumptions
- stale comments around sign-in gating or migration behavior
- any no-longer-reachable client state paths in planner import/save flows

This is not a request to remove valid dev-only auth or active compatibility protections. It is a request to remove branches that are no longer reachable or meaningful.

### Phase 2 verification

- `npm test` passes
- `npx tsc --noEmit` passes
- `npm run build` passes
- saved plans, planner settings, `/dataset`, and auth flows still work in the current app model

**Commit**: `refactor(cleanup): remove completed migration shims`

Implemented in:

- `92dc20c` - `refactor(cleanup): remove legacy compatibility paths`

---

## Phase 3: Deployment / Repo Surface Cleanup

This phase cleans the repo-level operational surface so contributors are not left choosing between old and new deployment stories.

### 3a. Audit deployment artifacts against the current intended VPS path

Review:

- `docs/ops/deployment.md`
- `Dockerfile`
- `docker-compose.yml`
- `nginx/`

Goal:

- ensure the repo only presents one current deployment shape
- remove or clearly mark obsolete scaffolding that belonged to the older self-signed/container-managed nginx setup

Likely outcome:

- either remove the stale `nginx/` artifacts entirely, or
- keep only the files that are still actively referenced by the current deployment instructions

### 3b. Move handoff docs out of the repo root

Move:

- `docs/dev/handoffs/country-dataset.md`
- `docs/dev/handoffs/dataset-methodology-split.md`

Into a dedicated docs/dev-style folder and update references accordingly.

Goal:

- keep useful historical coordination notes
- avoid leaving temporary handoff artifacts mixed into the repo root alongside long-lived product docs

### 3c. Tighten README / memory alignment

Ensure:

- `README.md`
- `CLAUDE.md`
- `AGENTS.md`

all describe the same current product/deployment model without stale references to removed flows or old admin routes.

### Phase 3 verification

- `cmd /c npm run docs:check-memory` passes
- deployment docs describe one clear production path
- no repo-root docs contradict the current `/dataset`, auth, saved-plan, or country-dataset model

**Commit**: `chore(cleanup): remove stale deployment and repo-surface artifacts`

Implemented in:

- `92dc20c` - `refactor(cleanup): remove legacy compatibility paths`
- `5f80220` - `chore(cleanup): move historical dev docs out of repo root`

---

## Phase 4: Verification, Documentation, And Merge Readiness

### 4a. Final verification sweep

Run:

```bash
cmd /c npm test
npx tsc --noEmit
npm run build
cmd /c npm run docs:check-memory
```

Also do a manual spot check of:

- `/dataset`
- `/estimates`
- `/plan`
- `/plan/compare`
- `/settings/account`
- signup/login flows

### 4b. Refresh project memory

Update:

- `CLAUDE.md`
- `AGENTS.md`

so the cleanup work is reflected in:

- known gaps
- recent important changes
- useful files

### 4c. PR readiness

- push `feat/cleanup-simplification`
- open PR against `main`
- summarize exactly what was removed vs intentionally kept
- call out any compatibility paths deliberately retained and why

### Phase 4 verification

- branch is pushed
- PR is open
- PR body references this plan
- cleanup removals are documented clearly enough that reviewers can assess risk
- PR: `#5` - `chore: finish cleanup and simplification pass`

**Commit**: `docs(cleanup): finalize cleanup and merge notes`

### Current verification already completed

- verified locally on April 19, 2026
- `cmd /c npm test`
- `npx tsc --noEmit`
- `npm run build`
- `cmd /c npm run docs:check-memory`
- isolated seed smoke test via `cmd /c npx tsx ..\\src\\db\\seed.ts` from a temp workdir

---

## Non-Goals

The following are explicitly out of scope for this cleanup branch unless they become necessary to support a removal:

- transport-estimation caching
- new planner features
- new admin UX
- provider/model discovery redesign
- new auth capabilities beyond removing stale branches/comments
- major schema rewrites that would require destructive production data migrations

---

## Likely Files

- `docs/dev/plans/cleanup-simplification.md`
- `src/db/seed.ts`
- `src/db/schema.ts`
- `src/components/cities/CostEditor.tsx`
- `src/lib/user-data.ts`
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/ops/deployment.md`
- `Dockerfile`
- `docker-compose.yml`
- `nginx/*`
- `docs/dev/*`
