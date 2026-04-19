# Compare Page UI And Analytics Expansion - Implementation Plan

> **Branch**: `feat/compare-page-ui-analytics` off `main`
> **PR target**: `main`
> **Status**: IN PROGRESS - planning and branch setup
> **Related**:
> - `docs/dev/plans/compare-planned-allocations.md`
> - `src/app/plan/compare/page.tsx`
> - `src/components/itinerary/ComparisonSummaryCards.tsx`
> - `src/components/itinerary/ComparisonChart.tsx`
> - `src/app/page.tsx`

---

## Context

The compare page currently has the right calculation baseline but a lightweight presentation:

- a fixed-header compare page
- summary cards
- one cumulative planned spend chart

That is enough for basic comparison, but it is now behind the dashboard in both:

- chart variety
- layout maturity
- information density management

We want the compare page to become a stronger planned-only analytics surface by:

- improving the layout and readability of the plan summary cards
- introducing compare-specific versions of the dashboard's country and category figures
- making the inline UI adapt gracefully when the user compares more than two plans

This branch should **not** copy the dashboard literally. The compare page has a different job:

- dashboard: one actual trip versus actual spend
- compare page: multiple saved plan snapshots versus each other, planned-only

The design and chart choices should reflect that distinction explicitly.

---

## Design Anchors

- **Keep compare page semantics clean.** Do not reuse dashboard labels that imply actual spend where compare is planned-only.
- **Retain a clear page hierarchy.** The cumulative line chart remains the hero view; country and category charts are secondary analytical views.
- **Preserve readability as plan count increases.** The page should still work at 4-5 plans without crushing cards or making inline charts unreadable.
- **Reuse dashboard UI patterns selectively.** Expand dialogs, control placement, and chart-card shells should follow the dashboard's stronger interaction model, but the compare page should remain its own surface.
- **Use the canonical comparison engine only.** Any new chart or summary must derive from `src/lib/plan-comparison.ts` outputs or extensions to that same engine.
- **Inline views should summarize; expanded views should exhaust.** For denser comparisons, the page should intentionally limit inline detail and rely on expand dialogs for full fidelity.

---

## Goals

By the end of this workstream:

- compare-page summary cards are wider and easier to scan
- summary cards adapt gracefully from 2 through 5 compared plans
- compare page includes:
  - a full-width cumulative planned spend hero chart
  - a planned-by-country compare chart
  - a planned-by-category compare chart
- chart layouts and legends remain readable as plan count grows
- chart interactions follow the dashboard's expand-dialog pattern
- all new figures still derive from the canonical compare calculation model

---

## Task Tracker

Use this as the primary handoff/resume checklist for the branch.

- [x] Phase 0 - Create implementation plan and branch scaffold
- [x] Phase 0a - Audit the current compare page layout and dashboard chart patterns
- [x] Phase 0b - Lock the recommended compare-page layout and chart choices
- [x] Phase 1 - Extend the canonical compare payload for richer charting
- [x] Phase 1a - Add chart-friendly compare outputs for per-country totals and planned-day metrics
- [x] Phase 1b - Confirm category totals and any percentage helpers needed for the category chart
- [x] Phase 1c - Keep all new metrics inside the canonical compare engine rather than chart-side derivations
- [x] Phase 2 - Refactor compare-page layout and summary-card presentation
- [x] Phase 2a - Replace the fixed summary-card grid with a wider responsive horizontal rail
- [x] Phase 2b - Preserve a clean page hierarchy: summary rail, hero chart, secondary chart section
- [x] Phase 2c - Add dynamic layout rules for 2-3 plans versus 4-5 plans
- [x] Phase 3 - Add the planned-by-country compare chart
- [x] Phase 3a - Implement grouped horizontal country bars with one series per compared plan
- [x] Phase 3b - Add `Totals` / `Per Day` modes using canonical compare payload fields
- [x] Phase 3c - Limit the inline view to a readable top-country subset while keeping the expanded dialog exhaustive
- [x] Phase 4 - Add the planned-by-category compare chart
- [x] Phase 4a - Implement the inline category chart as stacked-by-plan composition
- [x] Phase 4b - Implement the expanded category view as grouped-by-category comparison
- [x] Phase 4c - Add dynamic legend, label, and sizing behavior for 2-5 plans
- [ ] Phase 4.5 - Run a compare-chart visual alignment pass before Phase 5 wrap-up
- [x] Phase 4.5a - Centralize `PLAN_COLORS` and standardize compare-page plan colors to `blue -> purple -> teal -> yellow -> green`
- [x] Phase 4.5b - Remove the duplicate legend from the planned-by-category chart and keep one clear legend treatment
- [x] Phase 4.5c - Sync the inline card heights for the planned-by-country and planned-by-category cards
- [ ] Phase 4.5d - Inline and expanded planned-by-country chart must be visually identical: same plot type, colors, axes, legend, and controls; expanded only shows more rows and more breathing room
- [ ] Phase 4.5e - Inline and expanded planned-by-category chart must be visually identical; use grouped horizontal bars (categories on y-axis, plans as grouped bars) in both states and delete the stacked-vertical implementation
- [ ] Phase 4.5f - Fix tooltip/legend labels to use plan names instead of `plan_0` / `plan_1` in grouped compare charts
- [ ] Phase 5 - Polish, test, and document the compare UI expansion
- [ ] Phase 5a - Add unit and/or component coverage for new compare payload extensions
- [ ] Phase 5b - Add Playwright coverage for 2-plan and 5-plan compare-page readability and chart rendering
- [ ] Phase 5c - Refresh project memory, push branch, and open the implementation PR

### Handoff Notes

- The compare-page calculation model was just canonicalized in `compare-planned-allocations`.
- This branch should build on that result rather than introducing chart-specific data shaping outside the compare engine.
- The dashboard's `Planned vs Actual by Country` chart must be reinterpreted for compare as a **planned-only** country comparison.
- The dashboard's category chart can be adapted more directly, but the compare version should compare plans against each other rather than planned versus actual.
- Before Phase 5c, run a small visual-consistency pass on the compare charts:
  - reorder compare plan colors to `blue -> purple -> teal -> yellow -> green`
  - centralize the palette constant (currently duplicated across `ComparisonChart`, `ComparisonCountryChart`, `ComparisonCategoryChart`, `ComparisonSummaryCards`)
  - keep only one category legend in the inline card
  - make the country/category inline cards align in height
  - inline and expanded country/category charts must be visually identical in plot type, colors, axes, legend, and controls; expanded only scales up size/detail
  - fix compare tooltip labels that currently read `plan_0` / `plan_1`

---

## Non-Goals

The following are intentionally out of scope unless a dependency forces them in:

- redesigning the planner save/select flow
- adding actual-spend data to compare page
- merging compare page and dashboard into one shared screen
- changing the saved-plans DB model
- changing the canonical planned-allocation math itself, unless a new chart requirement exposes a real bug

---

## Recommended UI Direction

### 1. Summary cards become a horizontal rail

Replace the fixed compare-card grid with a horizontally scrollable summary rail:

- each plan card gets a minimum readable width
  - target starting point: `min-w-[300px]` to `min-w-[340px]`
- cards can sit comfortably side-by-side for 2 plans
- at 4-5 plans, the rail scrolls horizontally instead of crushing text into narrow grid columns

Why this is the preferred model:

- compare cards are information-dense
- a fixed grid gets cramped quickly as plan count rises
- a rail preserves legibility without forcing the rest of the page to become extra wide

### 2. Cumulative planned spend remains the hero chart

The full-width cumulative chart stays at the top of the analytical section because it answers the most important compare question first:

- how do these plans diverge over time?

It should continue to:

- span the full page width
- keep the expand dialog pattern
- use consistent per-plan colors that match the summary rail and the secondary charts

### 3. Add a two-chart secondary section

Under the hero chart, add:

- left: `Planned Spend by Country`
- right: `Planned Spend by Category`

Desktop behavior:

- 2-3 plans: render the country and category cards side-by-side
- 4-5 plans: stack the secondary charts vertically for readability

Mobile behavior:

- always stack vertically

### 4. Inline views summarize; expanded views fully detail

Inline cards should stay intentionally concise:

- country chart should show only the most important countries inline
- category chart should keep labels and legend compact

Expanded dialogs should provide:

- the complete dataset
- the richer legend treatment
- any control variants that are too dense for the inline card

---

## Recommended Chart Choices

### Planned by Country

Use a **grouped horizontal bar chart**:

- rows = countries
- bars within each row = compared plans
- sort by highest combined planned spend across all compared plans

Modes:

- `Totals`
- `Per Day`

Why this is the recommended first implementation:

- easiest country-comparison shape to read
- works with long country names
- stays aligned with the dashboard's existing horizontal bar pattern
- supports plan-to-plan comparison more directly than a stacked bar

Inline behavior:

- show top `N` countries by combined planned spend
- initial recommendation:
  - `N = 8` for 2-3 plans
  - `N = 6` for 4-5 plans

Expanded behavior:

- show all countries
- preserve the `Totals` / `Per Day` controls

### Planned by Category

Use a **split mode by context**:

- inline chart: stacked-by-plan composition
- expanded chart: grouped-by-category comparison

Inline composition chart:

- x-axis = compared plans
- stacked segments = spend categories
- answers: "what is the shape of each plan?"

Expanded grouped chart:

- rows = categories
- bars within each row = compared plans
- answers: "how does this specific category differ across plans?"

Why this is the preferred approach:

- categories are few, so both shapes remain readable
- inline composition gives a quick high-level fingerprint for each plan
- expanded grouped bars give the deeper analytical compare view when needed

Possible inline mode toggle:

- defer unless needed
- the default recommended version is one inline composition view plus a richer expanded dialog rather than adding another inline control immediately

---

## Dynamic Behavior Rules

### Card rail

- `2 plans`:
  - cards should appear spacious and close to full-summary width
- `3 plans`:
  - rail still works well with moderate horizontal overflow
- `4-5 plans`:
  - rail becomes the primary adaptation mechanism; do not compress cards into tiny columns

### Secondary chart layout

- `2-3 plans`:
  - use a 2-column desktop layout
- `4-5 plans`:
  - stack the country and category charts vertically even on desktop

### Country chart density

- increase left-axis width for long country labels
- reduce inline country count at higher plan counts
- keep full detail in expanded dialog

### Category chart density

- legend should become compact for 4-5 plans
- per-plan labels may need truncation or angled/two-line labels depending on chosen orientation
- inline chart should prioritize clean composition over dense labeling

---

## Data Model And API Implications

Current compare payload already supports:

- `summary`
- `series`
- `countryTotals`
- `categoryTotals`

For the recommended country chart, the compare engine likely needs explicit per-country day metrics so compare page can support a true `Per Day` mode without inventing chart-side math.

Recommended compare-engine additions per plan:

```ts
countryTotals: Array<{
  countryId: string | null
  countryName: string | null
  totalPlanned: number
  plannedDays: number
  plannedPerDay: number | null
}>
```

Possible compare-engine additions for category presentation:

- category percentage helpers are optional
- percentages can be derived cheaply in the compare-page chart component from canonical `categoryTotals`
- do not add extra compare-engine surface unless the inline stacked category chart needs stronger server-owned shaping

Rule:

- all new country/category metrics must still be derived inside `src/lib/plan-comparison.ts`
- `/api/saved-plans/compare` remains a thin transport layer

---

## Proposed Layout Structure

Recommended compare results order:

1. summary rail
2. full-width `Cumulative Planned Spend`
3. secondary analytics section:
   - `Planned Spend by Country`
   - `Planned Spend by Category`

This creates a clear reading order:

- overview of each plan
- timeline divergence
- geographic composition
- category composition

---

## Implementation Strategy

## Phase 0: Planning And Design Lock

### 0a. Audit current compare and dashboard surfaces

Review:

- compare-page header and result structure
- summary-card layout constraints
- dashboard chart-card shells
- expand-dialog patterns
- chart controls and density strategies already working on `/`

### 0b. Lock chart and layout decisions

Adopt these decisions for implementation:

- summary cards become a horizontal rail
- cumulative chart stays hero and full-width
- country chart uses grouped horizontal bars
- country chart supports `Totals` / `Per Day`
- category chart uses inline stacked composition + expanded grouped comparison
- secondary chart section stacks at higher plan counts

### Phase 0 verification

- plan doc exists
- task tracker includes sub-tasks
- chart choices are explicit rather than left open-ended

**Commit**: `docs(compare-ui): add compare page analytics plan`

---

## Phase 1: Extend Canonical Compare Payload

### 1a. Add country-day metrics

Update `src/lib/plan-comparison.ts` so country totals can support:

- planned total
- planned days
- planned per-day value

These should come from the canonical allocation model rather than from UI post-processing.

### 1b. Validate category payload sufficiency

Confirm the current `categoryTotals` shape is sufficient for:

- inline stacked composition
- expanded grouped category bars

If a small helper field is justified, add it in the compare engine; otherwise leave percentages client-derived.

### 1c. Keep route thin

`/api/saved-plans/compare` should only:

- load snapshots
- build dependencies
- call compare engine

No chart-specific derivation should leak into the route.

### Phase 1 verification

- compare payload contains the metrics needed for all recommended charts
- no parallel chart math path is introduced outside the compare engine

**Commit**: `feat(compare-ui): extend compare payload for analytics charts`

---

## Phase 2: Compare Layout Refactor

### 2a. Build summary rail

Replace the fixed grid in `ComparisonSummaryCards` with:

- a horizontal scroll container
- min-width plan cards
- stable per-plan color markers

### 2b. Rebuild result section hierarchy

Update `/plan/compare` results area to support:

- summary rail
- hero chart card
- secondary chart region

### 2c. Add dynamic layout switches

Use plan-count-aware layout logic so:

- 2-3 plans can use side-by-side secondary charts
- 4-5 plans automatically stack secondary charts vertically

### Phase 2 verification

- 2-plan compare looks meaningfully wider than today
- 5-plan compare remains readable without crushed cards

**Commit**: `feat(compare-ui): refactor compare page layout`

---

## Phase 3: Planned By Country Chart

### 3a. Add compare-specific country chart component

Build a grouped horizontal bar chart using compare payload country totals.

### 3b. Add `Totals` / `Per Day` controls

The compare page should expose the same conceptual toggle style as the dashboard, but planned-only:

- `Totals`
- `Per Day`

### 3c. Add expanded dialog and inline limit

Inline:

- top `N` countries only

Expanded:

- all countries
- full legend and axis treatment

### Phase 3 verification

- chart is readable at 2 plans and 5 plans
- `Per Day` mode is canonical and not chart-derived guesswork

**Commit**: `feat(compare-ui): add planned by country chart`

---

## Phase 4: Planned By Category Chart

### 4a. Add inline stacked-by-plan category chart

Render each compared plan as one stacked bar composed of spend categories.

### 4b. Add expanded grouped-by-category chart

Expanded dialog should switch to the more analytical grouped comparison view:

- rows/categories
- bars/plans

### 4c. Tune category legend and labels for higher plan counts

Ensure:

- consistent color mapping
- compact legend behavior
- readable labels at 4-5 plans

### Phase 4 verification

- inline chart gives a quick plan-composition read
- expanded chart supports category-specific comparison cleanly

**Commit**: `feat(compare-ui): add planned by category chart`

---

## Phase 4.5: Visual Alignment Pass

This phase exists to tighten presentation after the first chart implementations landed, but before the final Phase 5 wrap-up.

### 4.5a. Centralize and standardize compare-page plan colors

`PLAN_COLORS` is currently declared identically in four files:

- `src/components/itinerary/ComparisonChart.tsx`
- `src/components/itinerary/ComparisonCountryChart.tsx`
- `src/components/itinerary/ComparisonCategoryChart.tsx`
- `src/components/itinerary/ComparisonSummaryCards.tsx`

Consolidate into a single shared module (for example `src/lib/comparison-colors.ts`) and import from there in all four components. Delete the duplicated constants in the same commit.

Adopt one consistent compare-page plan color order everywhere plan colors appear:

- first: blue (`#3b82f6`)
- second: purple (`#8b5cf6`)
- third: teal (`#14b8a6`)
- fourth: yellow (`#eab308`)
- fifth: green (`#22c55e`)

Use the same ordered palette across:

- summary rail markers
- cumulative spend chart lines
- planned-by-country series colors
- planned-by-category plan-level legends/series
- any other compare-page plan-level legends or markers

### 4.5b. Keep one legend treatment in the category card

The inline category card currently renders **two** category legends: a custom `CategoryLegend` (circle dots) above the chart, and a Recharts `<Legend>` inside the chart (square swatches, top-right). Both describe the same category series.

Target:

- remove the built-in Recharts `<Legend>` from the stacked inline category chart and keep the custom `CategoryLegend` above the chart, so legend styling matches the country card's custom plan-color rail
- confirm the expanded category chart keeps a single legend that is consistent with whichever final chart form Phase 4.5e lands on
- avoid making the card taller just because two legends are competing for space

### 4.5c. Sync inline chart-card heights

The inline:

- planned-by-country card
- planned-by-category card

should align visually when shown side-by-side.

Measured today: card heights are ~528px vs ~519px (close, ~9px diff) and the inner Recharts plot areas are already identical. The **perceived** mismatch comes from uneven header stacks (title/subtitle/legend/controls), not the chart itself. Once Phase 4.5b removes the duplicate legend the headers will drift further apart, so this phase must normalize them.

Target:

- normalize header stacks so both cards have the same header min-height after 4.5b
- ensure the chart plot area sits at the same y-offset in both cards
- keep heights intentional and balanced regardless of whether the country card has the `Totals` / `Per Day` toggle and the category card does not

### 4.5d. Inline and expanded country chart must be visually identical

The inline and expanded planned-by-country views must be the **same chart** — only size and data density may differ. This is a stricter rule than "same chart family."

The expanded view may ONLY change:

- the number of rows rendered (inline = top N, expanded = all)
- the vertical space allocated to the plot
- the horizontal breathing room around the axes

The expanded view must MATCH the inline view on:

- chart type (grouped horizontal bars)
- color palette per plan (from the centralized palette)
- axis orientation, scale type, tick format
- legend style and placement (use the same custom plan-color legend in both states)
- `Totals` / `Per Day` control surface and default

Target:

- delete any bespoke "expanded-only" legend styling so the inline legend component is reused in the dialog
- reuse the same chart component/config across both states rather than maintaining two parallel render paths

### 4.5e. Inline and expanded category chart must be visually identical

Phase 4 shipped the category chart with two genuinely different forms:

- inline: stacked vertical bars (plans on x-axis, categories stacked)
- expanded: grouped horizontal bars (categories on y-axis, plans grouped)

That split violates the new rule. Phase 4.5e collapses the category chart onto a **single** chart form used in both inline and expanded states, where expansion only changes size/density.

Locked-in form: **grouped horizontal bars**

- categories on the y-axis
- one bar per plan per category, using the centralized plan color palette
- plan-level legend using the same custom legend component the country card uses
- no stacked-vertical fallback; the stacked-composition implementation is deleted in this phase

Why this form was chosen:

- it matches the planned-by-country chart layout, making the two inline cards read as a paired set
- it answers "how does each plan differ on a given category" directly, which is the primary compare-page question
- the category set is small and fixed, so there is no inline vs expanded row-count tradeoff — the inline view shows every category already, and expanded only grows the plot
- it shares a legend shape with the country card, which lets Phase 4.5c normalize header heights cleanly

Both states must MATCH on:

- chart type (grouped horizontal bars)
- color palette (centralized plan colors from 4.5a)
- axis orientation, scale type, tick format
- legend style and placement (custom plan-color legend, same component as the country card)
- any control surface added later (for example, a `Totals` / `Share` toggle)

Target:

- delete the stacked-vertical inline implementation and any helpers only it uses
- reuse the same chart component/config across both inline and expanded rather than maintaining two parallel render paths

### 4.5f. Fix plan-name labels in grouped compare charts

Both `ComparisonCountryChart` and the grouped view inside `ComparisonCategoryChart` render Recharts `<Bar>` elements with `dataKey={\`plan_${index}\`}` but no `name` prop. That causes tooltips and Recharts legends to display `plan_0`, `plan_1`, etc. instead of the actual plan name.

Target:

- pass `name={plan.name}` on each `<Bar>` in country and category grouped views
- verify tooltip and any Recharts legend lines show the real plan name
- make sure the fix lands in both the inline and expanded render paths (per 4.5d/4.5e those should be the same component, so one fix should cover both)

### Phase 4.5 verification

- compare-page plan colors are consistent across all plan-level visuals and come from a single shared palette module
- category card shows one legend treatment only
- inline country/category cards align in height when side-by-side, including equal header min-heights
- inline and expanded country chart are visually identical in chart type, axes, colors, legend, and controls
- inline and expanded category chart are visually identical in chart type, axes, colors, legend, and controls
- tooltips and Recharts legends everywhere on the compare page read real plan names, never `plan_0` / `plan_1`

**Commit**: `fix(compare-ui): align compare chart presentation`

---

## Phase 5: Testing, Docs, And PR Readiness

### 5a. Add coverage around new compare payload and layout states

Target:

- unit coverage for country-day compare metrics
- chart/data-shaping coverage where logic is isolated

### 5b. Add Playwright regression coverage

At minimum:

- 2-plan comparison renders wide summary rail and all three charts
- 5-plan comparison still renders readable inline layout
- expand dialogs open successfully for all compare charts

### 5c. Refresh memory and open the implementation PR

Update:

- `CLAUDE.md`
- `AGENTS.md`

Only do this after the Phase 4.5 visual-alignment pass is complete and manually reviewed.

Explain in the PR:

- why compare should not directly mirror dashboard semantics
- why the chosen chart shapes were selected
- how the layout adapts as plan count increases

### Phase 5 verification

- tests pass
- docs are current
- implementation PR is open

**Commit**: `docs(compare-ui): finalize compare analytics notes`

---

## Success Criteria

This workstream is successful when:

- compare-page plan cards are visibly wider and remain readable at 2-5 plans
- cumulative chart remains the clear hero
- compare page includes usable country and category charts derived from canonical compare data
- the page layout adapts intentionally as plan count rises
- inline charts stay readable while expanded views provide full fidelity
- no new chart-specific budget math is introduced outside the canonical compare engine

---

## Likely Files

- `docs/dev/plans/compare-page-ui-analytics.md`
- `src/lib/plan-comparison.ts`
- `src/app/api/saved-plans/compare/route.ts`
- `src/app/plan/compare/page.tsx`
- `src/components/itinerary/ComparisonSummaryCards.tsx`
- `src/components/itinerary/ComparisonChart.tsx`
- new compare chart components under `src/components/itinerary/`
- compare-page tests under `src/lib/*.test.ts` and `tests/playwright/*`
