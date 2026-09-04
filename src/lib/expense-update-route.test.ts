import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireCurrentUserId: vi.fn(async () => 'expense-update-user'),
}));

type DbModule = typeof import('@/db');
type ExpenseRouteModule = typeof import('@/app/api/expenses/[id]/route');

let dbModule: DbModule;
let routeModule: ExpenseRouteModule;
let tempDir: string;
const originalCwd = process.cwd();

function put(id: string, body: Record<string, unknown>) {
  return routeModule.PUT(
    new Request(`http://localhost/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id } }
  );
}

function readExpense(id: number) {
  return dbModule.sqlite
    .prepare('SELECT id, amount, amount_aud, currency, user_id, is_deleted, category FROM expenses WHERE id = ?')
    .get(id) as {
    id: number;
    amount: number;
    amount_aud: number | null;
    currency: string;
    user_id: string;
    is_deleted: number;
    category: string;
  };
}

describe.sequential('expense update route', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-expense-update-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    dbModule.sqlite.exec([
      'CREATE TABLE IF NOT EXISTS expenses (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  date TEXT NOT NULL,',
      '  amount REAL NOT NULL,',
      '  currency TEXT NOT NULL,',
      '  amount_aud REAL,',
      '  category TEXT NOT NULL,',
      '  subcategory TEXT,',
      '  description TEXT,',
      '  merchant TEXT,',
      '  leg_id INTEGER,',
      '  source TEXT,',
      '  wise_txn_id TEXT,',
      '  logged_by TEXT,',
      '  is_excluded INTEGER DEFAULT 0,',
      '  created_at TEXT,',
      '  updated_at TEXT,',
      '  user_id TEXT,',
      '  is_deleted INTEGER NOT NULL DEFAULT 0',
      ');',
    ].join('\n'));

    routeModule = await import('@/app/api/expenses/[id]/route');
  });

  beforeEach(() => {
    dbModule.sqlite.exec('DELETE FROM expenses');
    dbModule.sqlite
      .prepare(
        `INSERT INTO expenses (id, date, amount, currency, amount_aud, category, source, user_id, is_excluded, is_deleted)
         VALUES (1, '2026-03-01', 10, 'AUD', 10, 'food', 'manual', 'expense-update-user', 0, 0)`
      )
      .run();
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('recalculates amountAud when the amount changes', async () => {
    // Every total in the app sums amountAud. Leaving it stale meant an edited amount showed in
    // the expenses list and was silently absent from the dashboard and country totals.
    const response = await put('1', { amount: 250 });
    expect(response.status).toBe(200);

    const row = readExpense(1);
    expect(row.amount).toBe(250);
    expect(row.amount_aud).toBe(250);
  });

  it('leaves amountAud alone when only non-monetary fields change', async () => {
    await put('1', { category: 'drinks' });

    const row = readExpense(1);
    expect(row.category).toBe('drinks');
    expect(row.amount).toBe(10);
    expect(row.amount_aud).toBe(10);
  });

  it('ignores fields the edit form does not expose', async () => {
    // The handler previously spread the raw request body into the update, so a caller could
    // write any column on the row, including reassigning it to another user.
    const response = await put('1', {
      amount: 42,
      userId: 'someone-else',
      isDeleted: 1,
      id: 99999,
      source: 'wise_csv',
    });
    expect(response.status).toBe(200);

    const row = readExpense(1);
    expect(row.amount).toBe(42);
    expect(row.user_id).toBe('expense-update-user');
    expect(row.is_deleted).toBe(0);
    expect(row.id).toBe(1);
  });

  it('refuses to update an expense belonging to another user', async () => {
    dbModule.sqlite
      .prepare(
        `INSERT INTO expenses (id, date, amount, currency, amount_aud, category, source, user_id, is_excluded, is_deleted)
         VALUES (2, '2026-03-01', 10, 'AUD', 10, 'food', 'manual', 'another-user', 0, 0)`
      )
      .run();

    const response = await put('2', { amount: 999 });
    expect(response.status).toBe(404);
    expect(readExpense(2).amount).toBe(10);
  });
});
