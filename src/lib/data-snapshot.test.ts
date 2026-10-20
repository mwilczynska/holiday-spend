import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDataSnapshot, restoreDataSnapshot, verifyDataSnapshot } from '../../scripts/lib/data-snapshot.mjs';

let directory: string;
let source: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-snapshot-'));
  source = path.join(directory, 'original', 'travel.db');
  fs.mkdirSync(path.dirname(source));
  fs.mkdirSync(path.join(path.dirname(source), 'city-images'));
  fs.writeFileSync(path.join(path.dirname(source), 'city-images', 'large.jpg'), 'large-image');
  fs.writeFileSync(path.join(path.dirname(source), 'city-images', 'small.jpg'), 'small-image');
  const db = new Database(source);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE countries(id TEXT PRIMARY KEY);
    CREATE TABLE cities(id TEXT PRIMARY KEY, country_id TEXT REFERENCES countries(id), cost REAL);
    CREATE TABLE city_images(id TEXT PRIMARY KEY, city_id TEXT REFERENCES cities(id), status TEXT, large_file TEXT, small_file TEXT);
    CREATE TABLE city_estimates(id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE expenses(id INTEGER PRIMARY KEY, amount REAL);
    INSERT INTO countries VALUES ('country');
    INSERT INTO cities VALUES ('city', 'country', 123.45);
    INSERT INTO city_images VALUES ('photo','city','ok','large.jpg','small.jpg');
    INSERT INTO expenses VALUES (1, 987.65);
  `);
  db.close();
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

describe('verified database and photo snapshots', { timeout: 20000 }, () => {
  it('restores complete data into a new directory and refuses to overwrite it', async () => {
    const destination = path.join(directory, 'snapshot');
    const before = fs.readFileSync(source);
    await createDataSnapshot({ source, destination });
    expect(verifyDataSnapshot(destination).tables.expenses.count).toBe(1);
    const restored = path.join(directory, 'restored');
    expect(restoreDataSnapshot(destination, restored).tables.cities.count).toBe(1);
    expect(fs.readFileSync(path.join(restored, 'city-images', 'large.jpg'), 'utf8')).toBe('large-image');
    expect(() => restoreDataSnapshot(destination, restored)).toThrow(/already exists/);
    expect(fs.readFileSync(source)).toEqual(before);
  });
  it('exports every catalogue row without personal expenses', async () => {
    const destination = path.join(directory, 'catalogue');
    await createDataSnapshot({ source, destination, mode: 'catalogue' });
    const manifest = verifyDataSnapshot(destination);
    expect(manifest.tables.cities.count).toBe(1);
    expect(manifest.tables.expenses.count).toBe(0);
    expect(manifest.files['city-images/small.jpg']).toBeDefined();
  });
  it('backs up and restores analytics for full packages while keeping catalogues private', async () => {
    const filename = path.join(path.dirname(source), 'analytics.db');
    const analytics = new Database(filename);
    analytics.exec("CREATE TABLE events(id TEXT PRIMARY KEY); INSERT INTO events VALUES ('event-one')");
    analytics.close();
    const full = path.join(directory, 'with-analytics');
    await createDataSnapshot({ source, destination: full });
    expect(verifyDataSnapshot(full).files['analytics.db']).toBeDefined();
    const restored = path.join(directory, 'restore-analytics');
    restoreDataSnapshot(full, restored);
    const copy = new Database(path.join(restored, 'analytics.db'), { readonly: true });
    expect(copy.prepare('SELECT id FROM events').get()).toEqual({ id: 'event-one' }); copy.close();
    const catalogue = path.join(directory, 'catalogue-without-analytics');
    await createDataSnapshot({ source, destination: catalogue, mode: 'catalogue' });
    expect(verifyDataSnapshot(catalogue).files['analytics.db']).toBeUndefined();
  });
  it('rejects corrupted photos and manifests that omit a referenced image', async () => {
    const destination = path.join(directory, 'snapshot');
    await createDataSnapshot({ source, destination });
    const manifestPath = path.join(destination, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.files['city-images/small.jpg'];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(() => verifyDataSnapshot(destination)).toThrow(/omits a referenced/);
    fs.writeFileSync(path.join(destination, 'city-images', 'large.jpg'), 'corrupt');
    expect(() => verifyDataSnapshot(destination)).toThrow(/checksum mismatch/);
  });
});
