import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ requireCurrentUserId: vi.fn(async () => 'expense-create-user') }));
vi.mock('@/lib/exchange-rates', () => ({ convertToAud: vi.fn() }));

let dbModule: typeof import('@/db');
let route: typeof import('@/app/api/expenses/route');
let convert: typeof import('@/lib/exchange-rates');
let tempDir: string;
const originalCwd = process.cwd();

function post(body: Record<string, unknown>) {
  return route.POST(new Request('http://localhost/api/expenses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-10-02', amount: 25, currency: 'USD', category: 'food', ...body }),
  }));
}

describe.sequential('expense creation conversion', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-expense-create-'));
    process.chdir(tempDir);
    vi.resetModules();
    dbModule = await import('@/db');
    dbModule.sqlite.exec(`CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, date TEXT, amount REAL, currency TEXT,
      amount_aud REAL, category TEXT, subcategory TEXT, description TEXT, merchant TEXT, leg_id INTEGER,
      source TEXT, wise_txn_id TEXT, logged_by TEXT, is_excluded INTEGER, is_deleted INTEGER DEFAULT 0,
      created_at TEXT, updated_at TEXT
    ); CREATE TABLE itinerary_legs (id INTEGER PRIMARY KEY, user_id TEXT);`);
    route = await import('@/app/api/expenses/route');
    convert = await import('@/lib/exchange-rates');
  });
  beforeEach(() => {
    dbModule.sqlite.exec('DELETE FROM expenses; DELETE FROM itinerary_legs');
    vi.mocked(convert.convertToAud).mockReset().mockResolvedValue(38.25);
  });
  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('converts a Quick Add foreign-currency expense before saving', async () => {
    const response = await post({});
    expect(response.status).toBe(201);
    expect(convert.convertToAud).toHaveBeenCalledWith(25, 'USD', '2026-10-02');
    expect((await response.json()).data).toMatchObject({ amount: 25, amountAud: 38.25, userId: 'expense-create-user' });
    expect(dbModule.sqlite.prepare('SELECT amount_aud FROM expenses').get()).toEqual({ amount_aud: 38.25 });
  });
  it('materializes AUD on new AUD expenses', async () => {
    vi.mocked(convert.convertToAud).mockResolvedValueOnce(25);
    const response = await post({ currency: 'AUD' });
    expect((await response.json()).data.amountAud).toBe(25);
  });
  it('keeps an explicit conversion without overwriting it', async () => {
    const response = await post({ amountAud: 40 });
    expect((await response.json()).data.amountAud).toBe(40);
    expect(convert.convertToAud).not.toHaveBeenCalled();
  });
  it('preserves an expense with missing conversion when the rate fails', async () => {
    vi.mocked(convert.convertToAud).mockRejectedValueOnce(new Error('Unavailable rate'));
    const response = await post({});
    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({ amount: 25, amountAud: null });
  });
  it('rejects invalid input without converting or inserting', async () => {
    expect((await post({ currency: '' })).status).toBe(400);
    expect(convert.convertToAud).not.toHaveBeenCalled();
    expect(dbModule.sqlite.prepare('SELECT COUNT(*) AS count FROM expenses').get()).toEqual({ count: 0 });
  });
  it('rejects another user\'s leg before converting or inserting', async () => {
    dbModule.sqlite.prepare('INSERT INTO itinerary_legs VALUES (?, ?)').run(7, 'another-user');
    expect((await post({ legId: 7 })).status).toBe(404);
    expect(convert.convertToAud).not.toHaveBeenCalled();
    expect(dbModule.sqlite.prepare('SELECT COUNT(*) AS count FROM expenses').get()).toEqual({ count: 0 });
  });
});
