# Handoff - Compare Page UI And Analytics

This handoff captures the current state of the `feat/compare-page-ui-analytics` branch after Phases 1 through 4 have been implemented locally, with a new pre-wrap-up visual-alignment phase (`Phase 4.5`) added but not yet executed.

## Current branch

- Branch: `feat/compare-page-ui-analytics`
- Base: `main`
- Plan file: `docs/dev/plans/compare-page-ui-analytics.md`
- Current HEAD: `63f1a77`
- Local branch upstream: none configured

## Remote / PR state

- Existing PR: [#7](https://github.com/mwilczynska/holiday-spend/pull/7)
- PR title: `docs(compare-ui): plan compare page analytics expansion`
- PR state: `OPEN`
- PR currently reflects only the original planning commit

Remote branch tip:

- `origin/feat/compare-page-ui-analytics`: `f81dc22`

Local-only implementation commits not yet pushed:

- `9bf0eef` - `feat(compare-ui): extend compare payload for analytics charts`
- `87a102a` - `feat(compare-ui): refactor compare page layout`
- `9798a5a` - `feat(compare-ui): add planned by country chart`
- `63f1a77` - `feat(compare-ui): add planned by category chart`

## Working tree status

At the time of this handoff:

- `docs/dev/plans/compare-page-ui-analytics.md` is modified but uncommitted

That uncommitted plan-doc edit adds a new pending `Phase 4.5` for chart visual alignment and explicitly delays `Phase 5c` until after manual review.

No additional code changes are left unstaged beyond that plan-doc update.

## Branch status

From `docs/dev/plans/compare-page-ui-analytics.md`:

- [x] Phase 0 - Create implementation plan and branch scaffold
- [x] Phase 1 - Extend the canonical compare payload for richer charting
- [x] Phase 2 - Refactor compare-page layout and summary-card presentation
- [x] Phase 3 - Add the planned-by-country compare chart
- [x] Phase 4 - Add the planned-by-category compare chart
- [ ] Phase 4.5 - Run a compare-chart visual alignment pass before Phase 5 wrap-up
- [ ] Phase 5 - Polish, test, and document the compare UI expansion

## What is implemented locally

### Phase 1 - Compare payload extensions

Implemented in:

- `src/lib/plan-comparison.ts`
- `src/lib/plan-comparison.test.ts`

What changed:

- `countryTotals` now include:
  - `plannedDays`
  - `plannedPerDay`
- these metrics are derived inside the canonical compare engine
- fixed costs with a `countryId` now resolve a country name from compare data so they merge into the correct country bucket rather than creating a duplicate `countryId + null-name` row

Verification already run:

- `npx tsc --noEmit`
- `cmd /c npx vitest run src/lib/plan-comparison.test.ts`
- `cmd /c npm test`

### Phase 2 - Compare layout refactor

Implemented in:

- `src/components/itinerary/ComparisonSummaryCards.tsx`
- `src/app/plan/compare/page.tsx`

What changed:

- summary cards moved from a fixed grid to a horizontal rail
- card width adapts by plan count so 2-plan compare is wider and 4-5 plans do not crush the content
- compare page shell widened to `max-w-[1440px]`
- results area now has clearer sections:
  - `Plan Overview`
  - `Spend Over Time`
  - `Plan Breakdown`

### Phase 3 - Planned by country chart

Implemented in:

- `src/components/itinerary/ComparisonCountryChart.tsx`
- `src/app/plan/compare/page.tsx`

What changed:

- added a grouped horizontal compare chart for `Planned Spend by Country`
- one series per compared plan
- added `Totals` / `Per Day` modes driven by canonical compare payload fields
- inline view limits country count:
  - top 8 countries for 2-3 plans
  - top 6 countries for 4-5 plans
- expanded dialog shows all countries

### Phase 4 - Planned by category chart

Implemented in:

- `src/components/itinerary/ComparisonCategoryChart.tsx`
- `src/app/plan/compare/page.tsx`

What changed:

- added `Planned Spend by Category`
- inline view is stacked-by-plan composition
- expanded view is currently also implemented, but this is the area the user wants revisited in the next pass because the inline and expanded forms do not feel aligned enough
- country/category charts now live in the same secondary analytics region on the compare page

## Current UX issues called out by the user

The user asked for a small design-alignment pass before continuing:

1. Standardize compare colors to this order:
   - blue
   - purple
   - teal
   - yellow
   - green

Notes:

- these are all colors already used in the compare UI
- this order should apply consistently across:
  - summary rail markers
  - cumulative compare chart
  - planned-by-country compare chart
  - any plan-level legends

2. Remove the duplicate legend in `Planned Spend by Category`

3. Make the two inline analytics cards feel aligned in height

Specifically:

- `Planned Spend by Country`
- `Planned Spend by Category`

4. Align inline versus expanded `Planned Spend by Country`

Current problem:

- the unexpanded and expanded versions feel too different in form/presentation
- the next pass should make them feel like the same chart family at different scales

5. Align inline versus expanded `Planned Spend by Category`

Current problem:

- the chart changes too much in type/form when expanded
- the next pass should keep the same chart family and use expansion mainly for size/readability/detail

## Plan-doc update already made locally

The plan-doc update adds:

- `Phase 4.5 - Visual Alignment Pass`
- `Phase 4.5a` - centralize `PLAN_COLORS` into a shared module and standardize compare plan colors to `blue -> purple -> teal -> yellow -> green` (`#3b82f6 / #8b5cf6 / #14b8a6 / #eab308 / #22c55e`)
- `Phase 4.5b` - remove the duplicate category legend; keep the custom `CategoryLegend` above the chart and drop the Recharts `<Legend>` from the inline stacked chart
- `Phase 4.5c` - sync inline country/category card heights by normalizing header stacks after 4.5b
- `Phase 4.5d` - inline and expanded `Planned Spend by Country` must be visually identical: same chart type, colors, axes, legend, and controls; expanded only scales size/detail
- `Phase 4.5e` - inline and expanded `Planned Spend by Category` must be visually identical; use **grouped horizontal bars** (categories on y-axis, plans as grouped bars) in both states and delete the stacked-vertical implementation
- `Phase 4.5f` - fix grouped compare tooltips/legends so they render real plan names instead of `plan_0` / `plan_1` (pass `name={plan.name}` on each `<Bar>`)

It also explicitly notes:

- do not do `Phase 5c` until the visual-alignment pass is complete and manually reviewed

## Recommended next steps

### 1. Finish Phase 4.5 before anything else

Implement the chart-alignment pass using the plan doc as the checklist.

Recommended order:

1. add one shared compare-page plan color constant in `src/lib/comparison-colors.ts` (or similar) and delete the four duplicated `PLAN_COLORS` arrays in the itinerary components
2. switch all plan-level compare visuals to that one ordered palette
3. remove the duplicate inline category legend (drop the Recharts `<Legend>` in the stacked view)
4. normalize country/category card header min-heights so both cards feel equal when side-by-side
5. refactor inline/expanded country chart so they render from the same component/config and only differ in row count and plot size
6. replace the stacked-vertical inline category chart with the grouped-horizontal form used in the expanded dialog, then reuse one component for both inline and expanded states
7. pass `name={plan.name}` on each `<Bar>` so tooltips/legends stop showing `plan_0` / `plan_1`

### 2. Stop for manual testing again

The user explicitly wants manual testing before `Phase 5c`.

That means:

- do not update memory docs yet
- do not push the new implementation commits yet
- do not update PR #7 yet

unless the user explicitly changes that instruction

### 3. After manual approval, continue with Phase 5

After the user is happy with the visuals:

- finish `Phase 5a`
- finish `Phase 5b`
- only then do `Phase 5c`

### 4. Push implementation commits later

When the user approves:

- push local implementation commits to `origin/feat/compare-page-ui-analytics`
- update the existing PR #7 rather than opening a new PR

## Files most relevant for the next pass

- `docs/dev/plans/compare-page-ui-analytics.md`
- `docs/dev/handoffs/compare-page-ui-analytics.md`
- `src/app/plan/compare/page.tsx`
- `src/components/itinerary/ComparisonSummaryCards.tsx`
- `src/components/itinerary/ComparisonChart.tsx`
- `src/components/itinerary/ComparisonCountryChart.tsx`
- `src/components/itinerary/ComparisonCategoryChart.tsx`
- `src/lib/plan-comparison.ts`
- `src/lib/plan-comparison.test.ts`

## Verification already completed on the local implementation

Verified successfully after the local implementation checkpoints:

- `npx tsc --noEmit`
- `cmd /c npm test`

Additional targeted compare verification already run earlier in the branch:

- `cmd /c npx vitest run src/lib/plan-comparison.test.ts`

## Short resume prompt

If resuming in a later session, the immediate task is:

> Continue on `feat/compare-page-ui-analytics`. Read `docs/dev/plans/compare-page-ui-analytics.md` and `docs/dev/handoffs/compare-page-ui-analytics.md`. Implement the pending `Phase 4.5` visual-alignment pass only. Do not proceed to `Phase 5c` until after manual review.
