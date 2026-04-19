# Compare Page Planned Allocations - Implementation Plan

> **Branch**: `feat/compare-planned-allocations` off `main`
> **PR target**: `main`
> **Status**: IN PROGRESS - planning and branch setup
> **Related**:
> - `docs/dev/plans/saved-plans-comparison.md`
> - `src/lib/plan-comparison.ts`
> - `/plan/compare`

---

## Context

The compare page currently exposes one visible budgeting concept, but it computes that budget in two different ways:

- the comparison summary total uses canonical leg math:
  - `dailyCost * nights + intercity transport + fixed costs`
- the cumulative chart derives planned spend by iterating every inclusive date from `startDate` through `endDate`

That creates a mismatch whenever a saved leg's explicit dates span more calendar days than its `nights` count.

Observed examples:

- `Plan 2026-04-16 Europe test01`
  - stored total and recomputed total: `104,972.51`
  - chart final cumulative: `119,131.26`
  - overcount: `14,158.75`
- `Plan 2026-04-17 Latin America test02`
  - stored total and recomputed total: `96,562.65`
  - chart final cumulative: `109,080.54`
  - overcount: `12,517.89`

The immediate bug is the compare-page inconsistency. The broader design issue is that the compare page does not yet have a single reusable planned-cost model that can safely power:

- summary totals
- cumulative planned spend
- future planned-vs-actual by-country views
- future planned spend by category views

This workstream fixes the mismatch by introducing one canonical planned-allocation model and deriving all compare-page outputs from it.

---

## Design Anchors

- **One canonical planned-cost model.** The compare page should not have separate budget formulas for totals, lines, or future grouped charts.
- **Totals must reconcile everywhere.** The final cumulative chart point, plan summary total, country totals, and category totals must all sum to the same number within rounding tolerance.
- **Dates are for allocation and positioning, not for redefining budget truth.** Explicit `startDate` / `endDate` should not silently override `nights` and change a leg's total cost.
- **Future compare-page charts should reuse the same data model.** This work should reduce future chart work, not create another layer of chart-specific calculation code.
- **Keep current saved-plan meaning intact.** Saved snapshots remain archival copies of plan inputs; comparison may continue to replay them against current city rates, but all compare outputs must derive from the same replay logic.
- **Fix the bug narrowly first.** Do not redesign the entire compare UI in this branch unless needed to support the canonical allocation model cleanly.

---

## Goals

By the end of this workstream:

- `/plan/compare` uses one canonical planned-allocation model for every plan
- comparison summary totals and final cumulative chart values always match
- planned allocations can be grouped by:
  - date
  - leg
  - country
  - category
- future compare-page country/category charts can be added without new budget math
- regression tests prevent date-range vs nights mismatches from reappearing

---

## Task Tracker

Use this as the primary handoff/resume checklist for the branch.

- [x] Phase 0 - Create implementation plan and branch scaffold
- [x] Phase 1 - Refactor `src/lib/plan-comparison.ts` to build canonical planned-allocation rows and derived grouped outputs
- [ ] Phase 2 - Align `/api/saved-plans/compare` and compare-page consumers to the canonical comparison engine
- [ ] Phase 3 - Add regression tests for `nights` vs inclusive-date mismatch and reconciliation invariants
- [ ] Phase 4 - Refresh docs, push branch, and open PR

### Handoff Notes

- The branch starts from `main` after the cleanup/docs reorganization merge.
- The known discrepancy reproduced on both test plans is caused by inclusive date enumeration in the chart path, not by stale saved-plan summary rows.
- Future compare-page country/category charts are intentionally part of the target data model, even if their UI does not ship in this branch.

---

## Non-Goals

The following are intentionally out of scope unless needed to support the canonical allocation model:

- redesigning the compare page layout
- adding the new by-country or by-category compare charts in this branch
- changing how saved snapshots are stored in the database
- changing the planner's save-time total logic unless a clear mismatch requires it
- changing dashboard calculation behavior outside the compare-page reuse boundary

---

## Root Cause Summary

Current compare logic in `src/lib/plan-comparison.ts` does this:

1. compute canonical leg totals with `getLegTotal(dailyCost, nights, intercityCost)`
2. also build `plannedByDate` by iterating `enumerateDates(startDate, endDate)`
3. add one daily amount for every enumerated date
4. build the cumulative chart from `plannedByDate`

Those two paths are not equivalent when:

- `enumerateDates(startDate, endDate).length !== nights`

The chart overcounts because `enumerateDates()` is inclusive while the canonical leg total uses `nights`.

This branch removes that split by generating every compare-page view from one canonical planned-allocation dataset.

---

## Proposed Model

### Canonical concept: planned allocation rows

Introduce an internal compare-page allocation model that captures planned spend at a finer grain than the current summary + series shape.

Suggested row shape:

```ts
interface PlannedAllocationRow {
  planId: string
  legId: number | null
  date: string | null
  countryId: string | null
  countryName: string | null
  cityId: string | null
  cityName: string | null
  category:
    | 'accommodation'
    | 'food'
    | 'drinks'
    | 'activities'
    | 'local_transport'
    | 'intercity_transport'
    | 'fixed_cost'
  amount: number
}
```

This model should be built once per compared plan and then grouped into:

- total budget
- cumulative series
- future by-country totals
- future by-category totals

### Canonical leg math

Leg budgets should continue to be defined by planner budget logic:

- accommodation, food, drinks, activities, local transport:
  - derived from the selected tiers and overrides
- intercity transport:
  - derived from `intercityTransports`
- leg total:
  - `dailyCost * nights + intercity transport`

### Allocation rule

The compare engine should allocate exactly the canonical amount for each leg and fixed cost.

For dated legs:

- use `startDate` to anchor allocation order
- allocate across exactly `nights` days, not necessarily every inclusive date through `endDate`
- if explicit `endDate` implies more days than `nights`, ignore the extra implied days for budget allocation

This keeps:

- timeline ordering
- visually useful daily distribution
- exact budget reconciliation

### Fixed-cost rule

Decide and standardize fixed-cost allocation now so future charts inherit a clean model:

- if a fixed cost has an explicit date:
  - allocate it fully on that date
- if it has no date:
  - keep current compare-page behavior of spreading across trip days for the cumulative line
- for future grouped views:
  - preserve its category as `fixed_cost`
  - if no country is attached, allow a null/unassigned country bucket rather than forcing a fake country match

---

## Implementation Strategy

## Phase 0: Plan And Data-Model Definition

### 0a. Document the canonical allocation approach

Create this plan and lock in:

- one planned-allocation model
- one canonical leg total definition
- one fixed-cost allocation rule

### 0b. Inventory compare-page consumers

Audit every compare-page budget consumer:

- `ComparisonSummaryCards`
- `ComparisonChart`
- saved-plan selector cards on `/plan/compare`
- `/api/saved-plans/compare`
- `src/lib/plan-comparison.ts`

### Phase 0 verification

- plan doc exists
- current discrepancy and target model are explicitly documented

**Commit**: `docs(compare): add canonical planned allocation plan`

---

## Phase 1: Canonical Allocation Builder

### 1a. Refactor `src/lib/plan-comparison.ts`

Replace the current split logic with a staged pipeline:

1. normalize and date the snapshot legs
2. compute canonical per-leg cost breakdown
3. build planned allocation rows
4. derive all public compare outputs from those rows

Suggested internal helpers:

```ts
function buildLegPlannedAllocations(...)
function buildFixedCostAllocations(...)
function buildPlanComparisonSummary(...)
function buildPlanComparisonSeries(...)
function buildPlanComparisonCountryTotals(...)
function buildPlanComparisonCategoryTotals(...)
```

### 1b. Introduce explicit public result extensions

Extend the comparison result shape to support future charts without needing another math rewrite.

Suggested additions:

```ts
countryTotals: Array<{
  countryId: string | null
  countryName: string | null
  totalPlanned: number
}>

categoryTotals: Array<{
  category: string
  totalPlanned: number
}>
```

These can ship unused by the UI initially, but should be produced by the same canonical allocation builder now.

### 1c. Remove chart-specific budget derivation

Remove the current duplicate path that:

- enumerates every inclusive date from `startDate` to `endDate`
- adds one full daily amount for every enumerated date

The cumulative series should instead be grouped from canonical allocation rows.

### Phase 1 verification

- the compare result is built from one internal allocation model
- no second chart-only total path remains

**Commit**: `refactor(compare): build canonical planned allocations`

---

## Phase 2: Compare API And UI Alignment

### 2a. Keep `/api/saved-plans/compare` thin

`src/app/api/saved-plans/compare/route.ts` should continue to:

- load snapshots
- build `cityMap`
- call canonical comparison logic

No duplicate grouping or chart math should live in the route.

### 2b. Align compare-page UI surfaces

Ensure the compare results area uses the same comparison payload everywhere:

- summary cards
- cumulative chart

Clarify the status of selector cards on `/plan/compare`:

- they are browse/select metadata from `saved_plans`
- they are not the authoritative comparison result once plans are loaded

If needed, adjust copy so users are not encouraged to compare selector-card totals with result-card totals as if they are independent calculations.

### 2c. Preserve current replay behavior intentionally

The compare engine may continue to replay snapshots against current city base rates if that remains the product rule. If so, document that clearly in code comments and plan notes.

### Phase 2 verification

- compare results render from one server payload
- result cards and final chart cumulative reconcile exactly

**Commit**: `fix(compare): align summary totals and cumulative chart`

---

## Phase 3: Regression Tests

### 3a. Unit coverage for comparison math

Add focused tests around the canonical allocation builder.

Must-cover cases:

- a leg where inclusive `startDate..endDate` count equals `nights`
- a leg where inclusive date count is greater than `nights`
- dated fixed costs
- undated fixed costs
- intercity transport on the first allocation day
- multi-leg plans where totals must reconcile across all grouping outputs

### 3b. Invariant assertions

At minimum, assert:

- `summary.totalBudget === final cumulative` within rounding tolerance
- `sum(countryTotals) === summary.totalBudget`
- `sum(categoryTotals) === summary.totalBudget`

### 3c. Regression fixture for the current bug class

Add a fixture that mimics the saved-plan discrepancy pattern:

- `nights = 7`
- `startDate = 2026-02-04`
- `endDate = 2026-02-11`

Expected result:

- one canonical budget value
- no overcount from the inclusive date window

### Phase 3 verification

- `npm test` passes
- comparison regression tests fail against the old logic and pass against the new logic

**Commit**: `test(compare): lock planned allocation reconciliation`

---

## Phase 4: Documentation And Merge Readiness

### 4a. Refresh project memory

Update:

- `CLAUDE.md`
- `AGENTS.md`

to document:

- compare-page planned allocations are now canonical
- result totals, country totals, category totals, and cumulative series reconcile by design

### 4b. Capture future chart follow-through

Document in memory or plan notes that the compare API now exposes the data needed for future:

- by-country compare charts
- by-category compare charts

### 4c. PR readiness

- push branch
- open PR
- explain the old split clearly:
  - `nights`-based total vs inclusive-date chart
- explain the new canonical allocation model clearly

### Phase 4 verification

- branch pushed
- PR open
- docs describe the new compare calculation model accurately

**Commit**: `docs(compare): finalize planned allocation notes`

---

## Success Criteria

This branch is successful when all of the following are true:

- for every compared plan, `summary.totalBudget` matches the final cumulative chart value
- comparison results come from one canonical planned-allocation model
- country/category totals are available from that same model
- the previous date-span overcount bug is covered by automated tests
- future compare-page chart work can reuse the new grouped totals without introducing new budget formulas

---

## Likely Files

- `docs/dev/plans/compare-planned-allocations.md`
- `src/lib/plan-comparison.ts`
- `src/app/api/saved-plans/compare/route.ts`
- `src/app/plan/compare/page.tsx`
- `src/components/itinerary/ComparisonChart.tsx`
- `src/components/itinerary/ComparisonSummaryCards.tsx`
- `src/components/itinerary/SavedPlansList.tsx`
- comparison tests under `src/lib/*.test.ts` and/or `tests/playwright/*`
