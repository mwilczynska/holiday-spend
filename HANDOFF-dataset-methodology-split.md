# Handoff: Dataset / Methodology Split

## What Was Done

The city-cost information architecture was split into two pages:

- `/dataset`
  - now owns the city cost editor
  - shows the dataset table
  - shows generation history
- `/estimates`
  - now shows methodology only

Routing and navigation changes:

- `src/app/dataset/page.tsx` added
- `src/app/settings/cities/page.tsx` now redirects to `/dataset`, preserving `?cityId=...`
- `src/app/settings/page.tsx` buttons now use `Dataset` and `Methodology`
- `src/components/layout/DesktopSidebar.tsx` now exposes `Dataset` and `Methodology`

## Verification

- `npm run build` passes
- direct `npx tsc --noEmit` is not reliable in this repo unless `.next/types` already exists
  - current failure is the known `.next/types/**/*.ts` include issue
  - the type-check phase inside `next build` passed

## Important Notes

- `HANDOFF-codex-phase-9.md` remains untracked and unrelated to this work
- this change set does **not** update `README.md`, `CLAUDE.md`, or `AGENTS.md`
  - those files still describe `/settings/cities` as the main city-cost editor
- mobile nav was not expanded with `Dataset` / `Methodology`
  - current access path on mobile is through `/settings`

## Suggested Next Steps

1. Decide whether the current nav is sufficient on mobile, or whether `MobileNav.tsx` should surface `Dataset` directly.
2. Update docs and project memory:
   - `README.md`
   - `CLAUDE.md`
   - `AGENTS.md` via `npm run docs:sync-memory`
3. Browser-check:
   - `/dataset`
   - `/dataset?cityId=...`
   - `/settings/cities?cityId=...` redirect
   - `/estimates`
4. If desired, rename `/estimates` route itself later.

## Files In This Change

- `src/app/dataset/page.tsx`
- `src/app/estimates/page.tsx`
- `src/app/settings/cities/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/layout/DesktopSidebar.tsx`
- `HANDOFF-dataset-methodology-split.md`
