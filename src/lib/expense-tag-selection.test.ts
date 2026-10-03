import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireCurrentUserId: vi.fn(async () => 'qa-user'),
  AuthRequiredError: class extends Error { status = 401; },
}));

let database: typeof import('@/db');
let route: typeof import('@/app/api/expenses/[id]/tags/route');
let tempDir: string;
const originalCwd = process.cwd();

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-tag-selection-'));
  process.chdir(tempDir);
  vi.resetModules();
  database = await import('@/db');
  database.sqlite.exec(`
    CREATE TABLE expenses (id INTEGER PRIMARY KEY, user_id TEXT, is_deleted INTEGER);
    CREATE TABLE tags (id INTEGER PRIMARY KEY, user_id TEXT, name TEXT);
    CREATE TABLE expense_tags (expense_id INTEGER, tag_id INTEGER, PRIMARY KEY(expense_id,tag_id));
  `);
  route = await import('@/app/api/expenses/[id]/tags/route');
});

beforeEach(() => {
  database.sqlite.exec(`
    DROP TRIGGER IF EXISTS qa_reject_tag;
    DELETE FROM expense_tags; DELETE FROM expenses; DELETE FROM tags;
    INSERT INTO expenses VALUES (1,'qa-user',0),(2,'other-user',0),(3,'qa-user',1);
    INSERT INTO tags VALUES (10,'qa-user','First'),(11,'qa-user','Second'),(12,'other-user','Private');
    INSERT INTO expense_tags VALUES (1,10),(2,12);
  `);
});

afterAll(() => {
  database?.sqlite.close();
  process.chdir(originalCwd);
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

const context = (id = '1') => ({ params: { id } });
const read = (id = '1') => route.GET(new Request('http://localhost/api/expenses/tags'), context(id));
const write = (tagIds: unknown[], id = '1') => route.PUT(new Request('http://localhost/api/expenses/tags', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagIds }),
}), context(id));

it('reads only owned tags and rejects foreign or deleted expenses', async () => {
  expect((await (await read()).json()).data).toEqual({ tags: [{ id: 10, name: 'First' }, { id: 11, name: 'Second' }], tagIds: [10] });
  for (const id of ['2', '3']) {
    expect((await read(id)).status).toBe(404);
    expect((await write([11], id)).status).toBe(404);
  }
});

it('rejects foreign and invalid tag IDs without losing existing assignments', async () => {
  expect((await write([11, 12])).status).toBe(404);
  expect((await write([0])).status).toBe(400);
  expect((await write([1.5])).status).toBe(400);
  expect((await (await read()).json()).data.tagIds).toEqual([10]);
});

it('replaces, deduplicates and clears assignments without touching other expenses', async () => {
  expect((await write([11, 11])).status).toBe(200);
  expect((await (await read()).json()).data.tagIds).toEqual([11]);
  expect((await write([])).status).toBe(200);
  expect((await (await read()).json()).data.tagIds).toEqual([]);
  expect(database.sqlite.prepare('SELECT * FROM expense_tags WHERE expense_id=2').all()).toEqual([{ expense_id: 2, tag_id: 12 }]);
});

it('rolls back removal when a replacement insert fails', async () => {
  database.sqlite.exec("CREATE TRIGGER qa_reject_tag BEFORE INSERT ON expense_tags WHEN NEW.tag_id=11 BEGIN SELECT RAISE(ABORT,'QA rejection'); END;");
  expect((await write([11])).status).toBe(500);
  expect((await (await read()).json()).data.tagIds).toEqual([10]);
});
