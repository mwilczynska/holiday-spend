import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { miscellaneousExpensesSchema } from './miscellaneous-expenses';
import { planSnapshotSchema } from './plan-snapshot';
import { computePlanComparison } from './plan-comparison';
import { getLegTotalFromTransports } from './cost-calculator';

let currentUserId = 'misc-alice';
vi.mock('@/lib/auth', () => ({ requireCurrentUserId: async () => currentUserId }));

describe.sequential('manual miscellaneous planner expenses', () => {
  let database: typeof import('@/db');
  let create: typeof import('@/app/api/itinerary/legs/route');
  let edit: typeof import('@/app/api/itinerary/legs/[id]/route');
  let snapshots: typeof import('@/app/api/itinerary/snapshot/route');
  let itinerary: typeof import('./itinerary-data');
  let dashboard: typeof import('./dashboard-data');
  let savedPlans: typeof import('@/app/api/saved-plans/route');
  let directory: string;
  let legId: number;
  const priorDatabasePath = process.env.HOLIDAY_SPEND_DB_PATH;

  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-misc-'));
    process.env.HOLIDAY_SPEND_DB_PATH = path.join(directory, 'test.db');
    const fixture = new Database(process.env.HOLIDAY_SPEND_DB_PATH);
    for (const table of Object.values(schema)) {
      const config = getTableConfig(table);
      // Omit the new column to exercise the automatic existing-database upgrade.
      fixture.exec(`CREATE TABLE "${config.name}" (${config.columns
        .filter(column => column.name !== 'miscellaneous_expenses')
        .map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
    }
    fixture.close();
    vi.resetModules();
    database = await import('@/db');
    create = await import('@/app/api/itinerary/legs/route');
    edit = await import('@/app/api/itinerary/legs/[id]/route');
    snapshots = await import('@/app/api/itinerary/snapshot/route');
    itinerary = await import('./itinerary-data');
    dashboard = await import('./dashboard-data');
    savedPlans = await import('@/app/api/saved-plans/route');
    await database.db.insert(schema.users).values([{ id: 'misc-alice' }, { id: 'misc-bob' }]);
    await database.db.insert(schema.countries).values({ id: 'qa-country', name: 'QA Country', currencyCode: 'AUD' });
    await database.db.insert(schema.cities).values({ id: 'qa-city', name: 'QA City', countryId: 'qa-country', accom2star: 100 });
  }, 30000);

  afterAll(() => {
    database?.sqlite.close();
    if (priorDatabasePath === undefined) delete process.env.HOLIDAY_SPEND_DB_PATH;
    else process.env.HOLIDAY_SPEND_DB_PATH = priorDatabasePath;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const request = (body: unknown) => new Request('http://localhost/api/itinerary/legs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const patch = (body: unknown) => edit.PUT(request(body), { params: { id: String(legId) } });

  it('defaults old snapshots to no expenses and rejects invalid amounts', () => {
    expect(planSnapshotSchema.parse({ legs: [{ cityId: 'qa-city', nights: 2 }] }).legs[0].miscellaneousExpenses).toEqual([]);
    for (const cost of [-1, NaN, Infinity, null, '12']) {
      expect(miscellaneousExpensesSchema.safeParse([{ description: 'Laundry', cost }]).success).toBe(false);
    }
    expect(getLegTotalFromTransports(100, 3, [{ cost: 30 }], [{ description: 'Laundry', cost: 12.5 }])).toBe(342.5);
  });

  it('creates and edits rows, retains zero, and refuses invalid and unowned updates', async () => {
    const response = await create.POST(request({ cityId: 'qa-city', nights: 3, startDate: '2026-10-01',
      miscellaneousExpenses: [{ description: ' Laundry ', cost: 12.5 }] }));
    expect(response.status).toBe(201);
    const leg = (await response.json()).data;
    legId = leg.id;
    expect(leg.miscellaneousExpenses).toEqual([{ description: 'Laundry', cost: 12.5 }]);
    expect((await patch({ miscellaneousExpenses: [{ description: 'Bad', cost: -1 }] })).status).toBe(400);
    expect((await patch({ miscellaneousExpenses: [{ description: 'Bad', cost: null }] })).status).toBe(400);
    currentUserId = 'misc-bob';
    expect((await patch({ miscellaneousExpenses: [] })).status).toBe(404);
    currentUserId = 'misc-alice';
    expect((await patch({ miscellaneousExpenses: [{ description: 'Laundry', cost: 12.5 }, { description: null, cost: 0 }] })).status).toBe(200);
    const loaded = (await itinerary.loadItinerary('misc-alice'))[0];
    expect(loaded.miscellaneousExpenses).toHaveLength(2);
    expect(loaded.legTotal).toBe(312.5);
  });

  it('counts each cost once across dashboard totals, country/category budgets and cumulative series', async () => {
    const inputs = await dashboard.loadDashboardInputs('misc-alice');
    expect(dashboard.buildDashboardSummary(inputs).totalBudget).toBe(312.5);
    const comparison = dashboard.buildPlannedVsActual(inputs);
    expect(comparison.comparison[0].planned).toBe(312.5);
    expect(comparison.plannedCategoryTotals.other).toBe(12.5);
    const series = dashboard.buildBurnRate(inputs).cumulative;
    expect(series[series.length - 1].plannedCumulative).toBe(312.5);
    const { setPlannerGroupSize } = await import('./planner-settings');
    await setPlannerGroupSize('misc-alice', 4);
    expect((await itinerary.loadItinerary('misc-alice'))[0].legTotal).toBe(612.5);
    await setPlannerGroupSize('misc-alice', 2);
  });

  it('preserves costs through export, saved-plan parsing, import and comparison', async () => {
    const exported = (await (await snapshots.GET()).json()).data;
    const snapshot = planSnapshotSchema.parse(exported);
    expect((await savedPlans.POST(request({ name: 'QA saved miscellaneous', snapshot,
      summary: { totalBudget: 312.5 } }))).status).toBe(201);
    const stored = (await database.db.select().from(schema.savedPlans))[0];
    expect(planSnapshotSchema.parse(JSON.parse(stored.snapshotJson)).legs[0].miscellaneousExpenses)
      .toEqual(snapshot.legs[0].miscellaneousExpenses);
    expect(snapshot.legs[0].miscellaneousExpenses).toEqual([{ description: 'Laundry', cost: 12.5 }, { description: null, cost: 0 }]);
    const cityRows = await database.db.select().from(schema.cities);
    const result = computePlanComparison('qa-plan', 'QA Plan', snapshot,
      new Map(cityRows.map(city => [city.id, { ...city, countryName: 'QA Country' }])));
    expect(result.summary.totalBudget).toBe(312.5);
    expect(result.categoryTotals).toContainEqual({ category: 'miscellaneous', totalPlanned: 12.5 });
    expect(result.countryTotals[0].totalPlanned).toBe(312.5);
    expect(result.series[result.series.length - 1].cumulativePlanned).toBe(312.5);
    expect((await snapshots.POST(request(snapshot))).status).toBe(200);
    const imported = (await itinerary.loadItinerary('misc-alice'))[0];
    expect(imported.miscellaneousExpenses).toEqual(snapshot.legs[0].miscellaneousExpenses);
    legId = imported.id;
    expect((await patch({ miscellaneousExpenses: [] })).status).toBe(200);
    expect((await itinerary.loadItinerary('misc-alice'))[0].legTotal).toBe(300);
  });
});
