import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireCurrentUserId: vi.fn(async () => 'qa-user'),
  AuthRequiredError: class extends Error { status = 401; },
}));

let database: typeof import('@/db');
let route: typeof import('@/app/api/itinerary/reorder/route');
let tempDir: string;
const originalCwd = process.cwd();

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-order-'));
  process.chdir(tempDir);
  vi.resetModules();
  database = await import('@/db');
  database.sqlite.exec('CREATE TABLE itinerary_legs (id INTEGER PRIMARY KEY, user_id TEXT, sort_order INTEGER);');
  route = await import('@/app/api/itinerary/reorder/route');
});
beforeEach(() => {
  database.sqlite.exec("DROP TRIGGER IF EXISTS qa_reject_order; DELETE FROM itinerary_legs; INSERT INTO itinerary_legs VALUES (1,'qa-user',1),(2,'qa-user',2),(3,'other-user',7);");
});
afterAll(() => {
  database?.sqlite.close();
  process.chdir(originalCwd);
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});
const write = () => route.PUT(new Request('http://localhost/api/itinerary/reorder', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ legIds: [2, 1, 3] }),
}));
const orders = () => database.sqlite.prepare('SELECT id, sort_order FROM itinerary_legs ORDER BY id').all();

it('saves owned leg order while leaving another user’s order unchanged', async () => {
  expect((await write()).status).toBe(200);
  expect(orders()).toEqual([{ id: 1, sort_order: 2 }, { id: 2, sort_order: 1 }, { id: 3, sort_order: 7 }]);
});
it('rolls back the full order when a later update fails', async () => {
  database.sqlite.exec("CREATE TRIGGER qa_reject_order BEFORE UPDATE ON itinerary_legs WHEN NEW.id=1 BEGIN SELECT RAISE(ABORT,'QA rejection'); END;");
  expect((await write()).status).toBe(500);
  expect(orders()).toEqual([{ id: 1, sort_order: 1 }, { id: 2, sort_order: 2 }, { id: 3, sort_order: 7 }]);
});
