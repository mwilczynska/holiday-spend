# Saved Plans & Comparison View — Implementation Plan

> **Branch**: `feat/saved-plans-comparison` off `main`
> **PR target**: `main`
> **Status**: IN PROGRESS

---

## Context

Wanderledger currently stores saved plan snapshots in browser `localStorage`. Plans are lost if the user clears their browser or switches devices. This feature moves them into the SQLite database (user-owned), surfaces them inline on `/plan`, and adds a multi-plan comparison view at `/plan/compare`.

The existing snapshot infrastructure (`PlanSnapshot` Zod schema in `src/lib/plan-snapshot.ts`, `GET/POST /api/itinerary/snapshot`) provides the serialization format. We need persistence, a better browsing UI, and a comparison engine.

---

## Checkpoints

- [x] **Phase 1** — Database table + CRUD API (commit 7ceb6b5)
- [x] **Phase 2** — Rewire planner UI from localStorage to API (commit 35f720b)
- [x] **Phase 3** — Comparison backend (server-side cost computation) (commits 37f8a1e, 00ebbe3)
- [x] **Phase 4** — Comparison UI (`/plan/compare` route + chart + cards) (commit 2ec1856)
- [x] **Phase 5** — Playwright E2E tests (commit bc4002c)
- [x] **Phase 6** — Documentation updates (CLAUDE.md) + cleanup
- [ ] **Phase 7** — PR creation

---

## Phase 1: Database Table + CRUD API

### 1a. Schema — `saved_plans` table

**File to modify**: `src/db/schema.ts`

Add Drizzle table definition:

```ts
export const savedPlans = sqliteTable('saved_plans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  snapshotJson: text('snapshot_json').notNull(),   // full PlanSnapshot JSON
  groupSize: integer('group_size').notNull().default(2),
  legCount: integer('leg_count').notNull().default(0),
  totalNights: integer('total_nights').notNull().default(0),
  totalBudget: real('total_budget').notNull().default(0),
  fixedCostCount: integer('fixed_cost_count').notNull().default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});
```

**Design decision**: JSON blob for snapshot data (not normalized). Summary columns (`leg_count`, `total_budget`, etc.) allow fast list queries without parsing JSON. Snapshots are archival — their legs/fixedCosts are never queried independently.

### 1b. Runtime bootstrap

**File to modify**: `src/db/index.ts`

Add `CREATE TABLE IF NOT EXISTS saved_plans (...)` block following the existing pattern — check `tableNames`, create if missing.

### 1c. API routes

**File to create**: `src/app/api/saved-plans/route.ts`

| Method | Purpose | Request | Response |
|--------|---------|---------|----------|
| GET | List user's plans (summary only, no snapshotJson) | — | `{ data: Array<{ id, name, groupSize, legCount, totalNights, totalBudget, fixedCostCount, createdAt, updatedAt }> }` |
| POST | Save current plan | `{ name, snapshot, summary }` | `{ data: { id, name, createdAt } }` |

**File to create**: `src/app/api/saved-plans/[id]/route.ts`

| Method | Purpose | Request | Response |
|--------|---------|---------|----------|
| GET | Full plan with snapshotJson | — | `{ data: { ...summary fields, snapshot: PlanSnapshot } }` |
| PATCH | Rename | `{ name }` | `{ data: { id, name, updatedAt } }` |
| DELETE | Delete (verifies userId ownership) | — | `{ data: { deleted: true } }` |

All routes use:
- `requireCurrentUserId()` from `src/lib/auth.ts`
- `success()`, `error()`, `handleError()` from `src/lib/api-helpers.ts`
- `planSnapshotSchema` from `src/lib/plan-snapshot.ts` for validation

### Phase 1 verification
- `npx tsc --noEmit` passes
- Manual curl/fetch to CRUD endpoints works

---

## Phase 2: Rewire Planner UI to Database

### 2a. New components

**File to create**: `src/components/itinerary/SavedPlansList.tsx`

Inline collapsible panel replacing the current `<Dialog>` modal:
- Renders between planner header and leg grid
- Collapsed by default: shows "Saved Plans (N)" header bar
- Expanded: scrollable list (max-height ~280px) of plan cards
- Each card: name, date, summary stats, Load/Export/Delete buttons
- "Compare" checkbox per card; "Compare Selected" button when 2+ checked → navigates to `/plan/compare?ids=...`

```ts
interface SavedPlansListProps {
  plans: SavedPlanSummary[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onCompare: (ids: string[]) => void;
  isLoading: boolean;
}
```

**File to create**: `src/components/itinerary/SavePlanDialog.tsx`

Small dialog replacing `window.prompt()` — text input + Save/Cancel buttons.

### 2b. Planner page rewiring

**File to modify**: `src/app/plan/page.tsx`

Changes:
1. Remove `PLAN_SNAPSHOT_STORAGE_KEY` constant and all localStorage read/write logic
2. Remove `savedSnapshots` / `persistSavedSnapshots` state
3. Add API-backed state: `savedPlans` fetched from `GET /api/saved-plans` on mount
4. `handleSaveSnapshot` → POST to `/api/saved-plans`
5. `handleDeleteSavedSnapshot` → DELETE to `/api/saved-plans/[id]`
6. `handleLoadSavedSnapshot` → GET `/api/saved-plans/[id]` for full snapshot, then import via existing `POST /api/itinerary/snapshot`
7. Replace `<Dialog open={savedPlansOpen}>` (lines 1327-1370) with inline `<SavedPlansList>`
8. Remove `savedPlansOpen` state

### 2c. localStorage migration

**File to create**: `src/lib/saved-plan-migration.ts`

```ts
export async function migrateLocalStoragePlans(): Promise<{ migrated: number; cleared: boolean }>
```

On mount: if localStorage has `wanderledger-plan-snapshots`, POST each to API, then clear localStorage. Runs once via `useEffect` gated by a ref.

### Phase 2 verification
- `npx tsc --noEmit` passes
- Browser: save/load/delete plans on `/plan` — all persist across page reload
- localStorage is empty after migration

---

## Phase 3: Comparison Backend

### 3a. Core computation

**File to create**: `src/lib/plan-comparison.ts`

```ts
export interface PlanComparisonSeries {
  date: string;
  cumulativePlanned: number;
  dailyPlanned: number;
}

export interface PlanComparisonResult {
  id: string;
  name: string;
  groupSize: number;
  summary: {
    totalBudget: number;
    totalNights: number;
    avgDailySpend: number;
    legCount: number;
    fixedCostTotal: number;
  };
  series: PlanComparisonSeries[];
}

export function computePlanComparison(
  planId: string,
  name: string,
  snapshot: PlanSnapshot,
  cityMap: Map<string, CityData>
): PlanComparisonResult
```

Logic:
1. `deriveLegDates()` from `src/lib/itinerary-leg-dates.ts` on snapshot legs
2. For each leg: look up city in `cityMap`, call `getDailyCost()` from `src/lib/cost-calculator.ts`
3. Build `plannedByDate: Map<string, number>` — for each date in [startDate, endDate], add daily cost; intercity transport on first day
4. Add fixed costs on their dates (or spread across trip if no date)
5. Build cumulative series using `enumerateDates()` from `src/lib/burn-rate.ts`
6. Compute summary totals

### 3b. Comparison API

**File to create**: `src/app/api/saved-plans/compare/route.ts`

- `POST` — Accepts `{ planIds: string[] }` (max 5)
- Fetches plans, validates snapshots, builds cityMap from cities table
- Calls `computePlanComparison()` per plan
- Returns `{ plans: PlanComparisonResult[] }`

### Phase 3 verification
- `npx tsc --noEmit` passes
- Manual POST to `/api/saved-plans/compare` returns correct cumulative series

---

## Phase 4: Comparison UI

### 4a. Comparison page

**File to create**: `src/app/plan/compare/page.tsx`

Route: `/plan/compare?ids=uuid1,uuid2,...`

Layout:
1. Header: "Compare Plans" + back-link to `/plan`
2. Summary cards row: one per plan (name, total budget, nights, avg $/day)
3. Cumulative spend chart: Recharts LineChart, one Line per plan, distinct colors
4. If no `ids` param: plan selector UI (fetch from `GET /api/saved-plans`, checkboxes, Compare button)

Nav: auto-highlights "Plan" via `pathname.startsWith('/plan')` — no nav changes needed.

### 4b. Chart component

**File to create**: `src/components/itinerary/ComparisonChart.tsx`

Uses `recharts` (existing dependency): `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer`, `CartesianGrid`.

5 distinct colors for up to 5 plans.

### 4c. Summary cards

**File to create**: `src/components/itinerary/ComparisonSummaryCards.tsx`

Uses existing `Card` component from `src/components/ui/card.tsx`.

### Phase 4 verification
- `npx tsc --noEmit` passes
- Browser: `/plan/compare?ids=...` renders chart and cards
- Browser: `/plan/compare` (no ids) shows plan selector

---

## Phase 5: Playwright Tests

### 5a. Saved plans tests

**File to create**: `tests/playwright/saved-plans.spec.ts`

1. Save a plan → verify appears in list
2. Delete a saved plan → verify gone
3. Load a saved plan → verify it loads
4. Persistence across reload → verify DB persistence
5. Compare navigation → select 2 plans, click Compare, verify URL

### 5b. Comparison tests

**File to create**: `tests/playwright/plan-comparison.spec.ts`

1. Chart + cards render with valid IDs
2. Handles invalid/missing IDs gracefully
3. Plan selector shown when no IDs in URL

### Phase 5 verification
- `npm run test:e2e` — all tests pass

---

## Phase 6: Documentation + Cleanup

- Update `CLAUDE.md`: move Priority 3 items to Completed Work, document `/plan/compare`, update Planner section
- Remove remaining localStorage snapshot references
- Clean up old `SavedPlanSnapshot` interface after migration is stable

### Phase 6 verification
- `npm run build` passes
- CLAUDE.md accurately reflects new state

---

## Phase 7: PR Creation

- Push `feat/saved-plans-comparison` to remote
- Create PR with summary of all changes
- Link back to this plan file

---

## Key Existing Code to Reuse

| What | File | Function/Export |
|------|------|-----------------|
| Snapshot validation | `src/lib/plan-snapshot.ts` | `planSnapshotSchema` |
| Cost computation | `src/lib/cost-calculator.ts` | `getDailyCost()`, `getLegTotal()`, `getDailyBreakdown()` |
| Date derivation | `src/lib/itinerary-leg-dates.ts` | `deriveLegDates()` |
| Date enumeration | `src/lib/burn-rate.ts` | `enumerateDates()` |
| Auth | `src/lib/auth.ts` | `requireCurrentUserId()` |
| API helpers | `src/lib/api-helpers.ts` | `success()`, `error()`, `handleError()` |
| Snapshot import | `src/app/api/itinerary/snapshot/route.ts` | POST handler |
| UI primitives | `src/components/ui/*` | Card, Dialog, Button, Input, Label, etc. |

## Architecture Notes

- **City cost drift**: Comparison uses snapshot tier selections + current city base rates. If city costs are updated after saving, comparison reflects new rates. This matches dashboard behavior and is acceptable.
- **Active itinerary ≠ saved plan**: Saving creates a snapshot copy. The active itinerary continues to be the source of truth for `/plan` and `/track`.
- **Max 5 plans per comparison**: Practical limit to keep chart readable and API response manageable.
