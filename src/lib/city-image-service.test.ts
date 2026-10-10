import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/db/schema');
  const os = await import('os');
  const nodeFs = await import('fs');
  const nodePath = await import('path');
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE countries (id TEXT PRIMARY KEY, name TEXT NOT NULL, currency_code TEXT NOT NULL, region TEXT);
    CREATE TABLE cities (id TEXT PRIMARY KEY, country_id TEXT NOT NULL REFERENCES countries(id), name TEXT NOT NULL);
    CREATE TABLE city_images (
      city_id TEXT PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE, city_name TEXT NOT NULL, country_code TEXT NOT NULL,
      status TEXT NOT NULL, data_json TEXT, large_file TEXT, small_file TEXT, fetched_at TEXT,
      last_attempt_at TEXT NOT NULL, last_error TEXT, version TEXT NOT NULL
    );
  `);
  const dataDirectory = nodeFs.mkdtempSync(nodePath.join(os.tmpdir(), 'city-images-test-'));
  return { db: drizzle(sqlite, { schema }), sqlite, schema, dataDirectory };
});

// Coordinates come from saved climate when present; these tests exercise the geocoding fallback.
vi.mock('./city-climate-service', () => ({ getStoredCityClimates: vi.fn().mockResolvedValue({}) }));

import { dataDirectory, sqlite } from '@/db';
import { cityImageDirectory, ensureCityImage, getCityImageRow, getCityImageViews } from './city-image-service';

const storedFiles = () => (fs.existsSync(cityImageDirectory()) ? fs.readdirSync(cityImageDirectory()).sort() : []);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const upload = (name: string) => `https://upload.wikimedia.org/thumb/${name}`;

/** Fake Open-Meteo, Wikipedia, Commons and upload servers for one city near (4.64, -75.57). */
function fakeNetwork(overrides: { geocode?: unknown; licence?: string; uploadHost?: string; failUpload?: boolean } = {}) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(url);
    const parsed = new URL(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (parsed.host === 'geocoding-api.open-meteo.com') {
      return json(overrides.geocode ?? { results: [{ name: 'Salento', country_code: 'CO', feature_code: 'PPLA2', population: 7000, latitude: 4.637, longitude: -75.57 }] });
    }
    if (parsed.host === 'en.wikipedia.org') {
      return json({ query: { pages: [{ index: 1, title: 'Salento, Quindío', coordinates: [{ lat: 4.64, lon: -75.57 }], pageimage: 'Valle.jpg' }] } });
    }
    if (parsed.host === 'commons.wikimedia.org') {
      const width = parsed.searchParams.get('iiurlwidth');
      return json({ query: { pages: [{ imageinfo: [{
        mime: 'image/jpeg', width: 4000, height: 3000, url: upload('Valle.jpg'),
        thumburl: `https://${overrides.uploadHost ?? 'upload.wikimedia.org'}/thumb/${width}px-Valle.jpg`,
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Valle.jpg',
        extmetadata: { LicenseShortName: { value: overrides.licence ?? 'CC BY-SA 4.0' }, Artist: { value: '<b>Ana</b>' } },
      }] }] } });
    }
    if (parsed.host === 'upload.wikimedia.org' || parsed.host === 'thumb.wikimedia.org') {
      if (overrides.failUpload) return new Response('busy', { status: 503 });
      return new Response(JPEG, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    }
    return new Response('unexpected', { status: 500 });
  });
  return { fetchImpl, calls };
}

beforeEach(() => {
  sqlite.exec('DELETE FROM city_images; DELETE FROM cities; DELETE FROM countries;');
  sqlite.exec("INSERT INTO countries VALUES ('colombia', 'Colombia', 'COP', 'south_america'); INSERT INTO cities VALUES ('salento', 'colombia', 'Salento');");
  fs.rmSync(cityImageDirectory(), { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(dataDirectory, { recursive: true, force: true });
});

describe('city image service', () => {
  it('collects, stores and serves a verified photo with its credit', async () => {
    const { fetchImpl } = fakeNetwork();
    expect(await ensureCityImage('salento', { fetchImpl })).toBe('ok');

    const view = getCityImageViews(['salento']).salento;
    expect(view).toMatchObject({ cityId: 'salento', artist: 'Ana', license: 'CC BY-SA 4.0', articleTitle: 'Salento, Quindío' });
    expect(view.src).toMatch(/^\/city-images\/salento\?v=/);
    expect(view.smallSrc).toContain('size=small');
    const row = getCityImageRow('salento')!;
    expect(fs.readFileSync(path.join(cityImageDirectory(), row.largeFile!))).toEqual(JPEG);
    expect(storedFiles()).toEqual([row.largeFile, row.smallFile].sort());
  });

  it('keeps a result until the city changes, then looks again', async () => {
    const { fetchImpl, calls } = fakeNetwork();
    await ensureCityImage('salento', { fetchImpl });
    const callsAfterFirst = calls.length;
    expect(await ensureCityImage('salento', { fetchImpl })).toBe('ok');
    expect(calls.length).toBe(callsAfterFirst);

    // A renamed city must not show the old photo.
    sqlite.exec("UPDATE cities SET name = 'Salento Viejo' WHERE id = 'salento'");
    expect(getCityImageViews(['salento'])).toEqual({});
  });

  it('records deterministic misses without retrying them', async () => {
    const { fetchImpl, calls } = fakeNetwork({ licence: 'Fair use' });
    expect(await ensureCityImage('salento', { fetchImpl })).toBe('no-free-image');
    const count = calls.length;
    expect(await ensureCityImage('salento', { fetchImpl, retryErrors: true })).toBe('no-free-image');
    expect(calls.length).toBe(count);
    expect(getCityImageViews(['salento'])).toEqual({});
  });

  it('treats an ambiguous place as a miss, not an error', async () => {
    const { fetchImpl } = fakeNetwork({ geocode: { results: [
      { name: 'Salento', country_code: 'CO', feature_code: 'PPL', population: 5000, latitude: 4.6, longitude: -75.6 },
      { name: 'Salento', country_code: 'CO', feature_code: 'PPL', population: 4000, latitude: 7.1, longitude: -73.1 },
    ] } });
    expect(await ensureCityImage('salento', { fetchImpl })).toBe('no-location');
  });

  it('refuses downloads from other hosts and retries transient errors on request', async () => {
    expect(await ensureCityImage('salento', { fetchImpl: fakeNetwork({ uploadHost: 'example.com' }).fetchImpl })).toBe('error');
    expect(await ensureCityImage('salento', { fetchImpl: fakeNetwork().fetchImpl })).toBe('error');
    expect(await ensureCityImage('salento', { fetchImpl: fakeNetwork().fetchImpl, retryErrors: true })).toBe('ok');
  });

  it('accepts thumbnails from the Commons thumbnail host', async () => {
    expect(await ensureCityImage('salento', { fetchImpl: fakeNetwork({ uploadHost: 'thumb.wikimedia.org' }).fetchImpl })).toBe('ok');
  });

  it('keeps the previous photo when a refresh fails', async () => {
    await ensureCityImage('salento', { fetchImpl: fakeNetwork().fetchImpl });
    expect(await ensureCityImage('salento', { fetchImpl: fakeNetwork({ failUpload: true }).fetchImpl, refresh: true })).toBe('ok');
    expect(getCityImageViews(['salento']).salento).toBeDefined();
  });

  it('drops the previous photo when a refresh no longer accepts it, and replaces files on success', async () => {
    await ensureCityImage('salento', { fetchImpl: fakeNetwork().fetchImpl });
    await ensureCityImage('salento', { fetchImpl: fakeNetwork().fetchImpl, refresh: true });
    expect(storedFiles()).toHaveLength(2);
    expect(await ensureCityImage('salento', { fetchImpl: fakeNetwork({ licence: 'Fair use' }).fetchImpl, refresh: true })).toBe('no-free-image');
    expect(getCityImageViews(['salento'])).toEqual({});
    expect(storedFiles()).toEqual([]);
  });

  it('falls back to the drawn scene when the stored file is missing', async () => {
    await ensureCityImage('salento', { fetchImpl: fakeNetwork().fetchImpl });
    fs.rmSync(path.join(cityImageDirectory(), getCityImageRow('salento')!.smallFile!));
    expect(getCityImageViews(['salento'])).toEqual({});
  });
});
