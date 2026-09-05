import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Partial: `handleError` does an `instanceof AuthRequiredError` check, so the real class has to
// survive the mock.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireCurrentUserId: vi.fn(async () => 'csv-user'),
}));

// No network in tests. Every fixture row is already AUD, so the resolver would not call out
// anyway; this makes that guarantee explicit rather than incidental.
vi.mock('@/lib/exchange-rates', () => ({
  getExchangeRate: vi.fn(async () => null),
  convertToAud: vi.fn(async () => null),
}));

// Seam for simulating a concurrent import. `findLegForExpenseDate` runs once per row after the
// duplicate check and before the insert, which is exactly the window the race lives in.
let onLegLookup: (() => void) | null = null;
vi.mock('@/lib/expense-leg-assignment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/expense-leg-assignment')>();
  return {
    ...actual,
    findLegForExpenseDate: (...args: Parameters<typeof actual.findLegForExpenseDate>) => {
      onLegLookup?.();
      return actual.findLegForExpenseDate(...args);
    },
  };
});

type DbModule = typeof import('@/db');
type CsvRoute = typeof import('@/app/api/expenses/import/csv/route');

let dbModule: DbModule;
let route: CsvRoute;
let tempDir: string;
const originalCwd = process.cwd();

const HEADER = [
  'ID',
  'Status',
  'Direction',
  'Created on',
  'Source amount (after fees)',
  'Source currency',
  'Target name',
  'Target amount (after fees)',
  'Target currency',
  'Reference',
  'Category',
].join(',');

function csvRow(id: string, options: { amount?: number; date?: string; merchant?: string } = {}) {
  const { amount = 25, date = '2026-04-03 10:00:00', merchant = 'Test Cafe' } = options;
  return [
    id,
    'COMPLETED',
    'OUT',
    `"${date}"`,
    amount.toFixed(2),
    'AUD',
    merchant,
    amount.toFixed(2),
    'AUD',
    'ref',
    'Restaurants',
  ].join(',');
}

function csv(ids: string[]) {
  return [HEADER, ...ids.map((id) => csvRow(id))].join('\n');
}

function post(csvText: string, confirm: boolean) {
  const form = new FormData();
  form.append('file', new File([csvText], 'wise.csv', { type: 'text/csv' }));
  if (confirm) form.append('confirm', 'true');
  return route.POST(new Request('http://localhost/api/expenses/import/csv', { method: 'POST', body: form }));
}

const CREATE_TABLES = [
  'CREATE TABLE IF NOT EXISTS expenses (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, amount REAL NOT NULL,',
  '  currency TEXT NOT NULL, amount_aud REAL, category TEXT NOT NULL, subcategory TEXT,',
  '  description TEXT, merchant TEXT, leg_id INTEGER,',
  "  source TEXT DEFAULT 'manual', wise_txn_id TEXT UNIQUE, logged_by TEXT,",
  '  is_excluded INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT,',
  '  user_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0',
  ');',
  'CREATE TABLE IF NOT EXISTS itinerary_legs (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT, city_id TEXT, start_date TEXT, end_date TEXT,',
  '  nights INTEGER NOT NULL, sort_order INTEGER, user_id TEXT',
  ');',
].join('\n');

describe.sequential('wise csv import route', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-csv-import-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec(CREATE_TABLES);
    route = await import('@/app/api/expenses/import/csv/route');
  });

  beforeEach(() => {
    onLegLookup = null;
    dbModule.sqlite.exec('DELETE FROM expenses; DELETE FROM itinerary_legs;');
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const storedIds = () =>
    (
      dbModule.sqlite
        .prepare("SELECT wise_txn_id FROM expenses WHERE user_id = 'csv-user' ORDER BY wise_txn_id")
        .all() as Array<{ wise_txn_id: string }>
    ).map((row) => row.wise_txn_id);

  function seedExisting(ids: string[]) {
    const stmt = dbModule.sqlite.prepare(
      "INSERT INTO expenses (date, amount, currency, category, wise_txn_id, user_id, source) VALUES ('2026-04-03', 25, 'AUD', 'food', ?, 'csv-user', 'wise_csv')"
    );
    for (const id of ids) stmt.run(id);
  }

  it('imports every row in the upload', async () => {
    const response = await post(csv(['a-1', 'a-2', 'a-3']), true);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.imported).toBe(3);
    expect(storedIds()).toEqual(['a-1', 'a-2', 'a-3']);
  });

  it('reports rows already in the ledger as duplicates rather than reimporting them', async () => {
    seedExisting(['b-2']);

    const preview = await (await post(csv(['b-1', 'b-2', 'b-3']), false)).json();
    expect(preview.data.duplicates).toHaveLength(1);
    expect(preview.data.duplicates[0].wiseTxnId).toBe('b-2');
    expect(preview.data.toImport).toHaveLength(2);

    const confirmed = await (await post(csv(['b-1', 'b-2', 'b-3']), true)).json();
    expect(confirmed.data.imported).toBe(2);
    expect(confirmed.data.duplicates).toBe(1);
    expect(storedIds()).toEqual(['b-1', 'b-2', 'b-3']);
  });

  it('detects duplicates across an upload larger than one lookup chunk', async () => {
    // The duplicate lookup is chunked, so the boundary is where an off-by-one would hide. 950 rows
    // spans three chunks, with duplicates placed inside each one and on both sides of a boundary.
    const ids = Array.from({ length: 950 }, (_, i) => `c-${i}`);
    seedExisting(['c-0', 'c-399', 'c-400', 'c-401', 'c-799', 'c-800', 'c-949']);

    const preview = await (await post(csv(ids), false)).json();

    expect(preview.data.duplicates.map((d: { wiseTxnId: string }) => d.wiseTxnId).sort()).toEqual(
      ['c-0', 'c-399', 'c-400', 'c-401', 'c-799', 'c-800', 'c-949'].sort()
    );
    expect(preview.data.toImport).toHaveLength(943);
  });

  it('collapses a transaction id repeated within one upload into a single row', async () => {
    // Wise splits some transactions across several lines, so `prepareWiseExpenses` groups by
    // transaction id and sums the amounts. A repeat inside an upload is therefore merged, not
    // inserted twice — which is why it is not what breaks a mid-import write.
    const response = await post(csv(['d-1', 'd-2', 'd-3', 'd-2', 'd-4']), true);
    expect(response.status).toBe(200);

    expect(storedIds()).toEqual(['d-1', 'd-2', 'd-3', 'd-4']);
    const merged = dbModule.sqlite
      .prepare("SELECT amount FROM expenses WHERE wise_txn_id = 'd-2'")
      .get() as { amount: number };
    expect(merged.amount).toBe(50);
  });

  it('writes nothing when a concurrent import claims one of the ids first', async () => {
    // The duplicate check is a read followed by a write, so an overlapping import committing
    // between the two makes the UNIQUE index reject a row partway through this one. Injected on
    // the leg lookup, which runs after the check and before the insert.
    seedExisting(['kept-1']);
    onLegLookup = () => {
      onLegLookup = null;
      seedExisting(['e-3']);
    };

    const response = await post(csv(['e-1', 'e-2', 'e-3', 'e-4']), true);

    expect(response.status).toBeGreaterThanOrEqual(400);
    // Only what was already there, plus the row the other import committed. Nothing from this one.
    expect(storedIds()).toEqual(['e-3', 'kept-1']);
  });

  it('assigns imported expenses to the itinerary leg covering their date', async () => {
    dbModule.sqlite
      .prepare(
        "INSERT INTO itinerary_legs (id, city_id, start_date, end_date, nights, sort_order, user_id) VALUES (501, 'lisbon', '2026-04-01', '2026-04-10', 9, 1, 'csv-user')"
      )
      .run();

    await post(csv(['f-1']), true);

    const row = dbModule.sqlite
      .prepare("SELECT leg_id FROM expenses WHERE wise_txn_id = 'f-1'")
      .get() as { leg_id: number | null };
    expect(row.leg_id).toBe(501);
  });
});
