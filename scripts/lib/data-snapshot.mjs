import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const catalogueTables = new Set(['countries', 'cities', 'city_estimates', 'city_price_inputs', 'city_climate', 'city_images']);
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const hashFile = file => createHash('sha256').update(readFileSync(file)).digest('hex');

/** @returns {Record<string, {count: number, sha256: string}>} */
export function databaseSummary(db) {
  /** @type {Record<string, {count: number, sha256: string}>} */
  const result = {};
  for (const { name, sql } of db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    const hash = createHash('sha256');
    let count = 0;
    const order = /\bWITHOUT\s+ROWID\b/i.test(sql)
      ? db.pragma(`table_info(${quote(name)})`).filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => quote(column.name)).join(',')
      : 'rowid';
    for (const row of db.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${order}`).iterate()) {
      hash.update(JSON.stringify(row) + '\n');
      count++;
    }
    result[name] = { count, sha256: hash.digest('hex') };
  }
  return result;
}

export function checkDatabase(db) {
  if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Database integrity check failed.');
  if (db.pragma('foreign_key_check').length) throw new Error('Database has broken foreign keys.');
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cities'").get()) throw new Error('City library is missing.');
}

function imagePath(directory, name) {
  const resolved = path.resolve(directory, name);
  if (path.dirname(resolved) !== path.resolve(directory)) throw new Error('Unsafe city image filename.');
  return resolved;
}

/** @param {{source: string, destination: string, mode?: string, analyticsSource?: string, ownerEmail?: string, ownerId?: string, ownerPasswordHash?: string}} options */
export async function createDataSnapshot({ source, destination, mode = 'full', analyticsSource, ownerEmail, ownerId = 'dev-local-user', ownerPasswordHash }) {
  source = path.resolve(source);
  destination = path.resolve(destination);
  if (!['full', 'catalogue'].includes(mode)) throw new Error('Mode must be full or catalogue.');
  if (existsSync(destination)) throw new Error('Snapshot destination already exists; choose a new directory.');
  if (!existsSync(source)) throw new Error('Source database does not exist.');
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const target = path.join(destination, 'travel.db');
  const original = new Database(source, { readonly: true, fileMustExist: true });
  let copy;
  try {
    checkDatabase(original);
    await original.backup(target);
    copy = new Database(target, { fileMustExist: true });
    copy.pragma('foreign_keys = ON');
    const before = databaseSummary(copy);
    const images = copy.prepare("SELECT large_file, small_file FROM city_images WHERE status = 'ok'").all();
    const imageDirectory = path.join(destination, 'city-images');
    mkdirSync(imageDirectory);
    const files = {};
    for (const row of images) {
      for (const name of [row.large_file, row.small_file]) {
        if (!name) throw new Error('A successful photo record has no file.');
        const from = imagePath(path.join(path.dirname(source), 'city-images'), name);
        const to = imagePath(imageDirectory, name);
        const beforeHash = hashFile(from);
        copyFileSync(from, to);
        if (hashFile(from) !== beforeHash || hashFile(to) !== beforeHash) throw new Error('A city photo changed during the snapshot; pause photo refresh and retry.');
        files['city-images/' + name] = { bytes: statSync(to).size, sha256: beforeHash };
      }
    }
    if (databaseSummary(original).city_images?.sha256 !== before.city_images?.sha256) throw new Error('Photo records changed during the snapshot; pause photo refresh and retry.');
    if (mode === 'catalogue') {
      copy.pragma('foreign_keys = OFF');
      copy.transaction(() => {
        for (const name of Object.keys(before)) if (!catalogueTables.has(name)) copy.exec(`DELETE FROM ${quote(name)}`);
        copy.exec("DELETE FROM sqlite_sequence WHERE name NOT IN ('city_estimates', 'city_price_inputs')");
      })();
      copy.pragma('foreign_keys = ON');
    } else if (ownerEmail) {
      if (!ownerPasswordHash || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error('Owner provisioning requires a valid email and an unusable random password hash.');
      copy.transaction(() => {
        if (!copy.prepare('SELECT 1 FROM user WHERE id = ?').get(ownerId)) throw new Error('Owner user ID does not exist.');
        const conflict = copy.prepare('SELECT id FROM user WHERE lower(email) = ? AND id != ?').get(ownerEmail.trim().toLowerCase(), ownerId);
        if (conflict) throw new Error('Owner email already belongs to another account; explicit ownership migration is required.');
        copy.prepare('UPDATE user SET email = ?, emailVerified = NULL, token_version = token_version + 1 WHERE id = ?').run(ownerEmail.trim().toLowerCase(), ownerId);
        copy.prepare("INSERT INTO user_passwords (user_id, hash) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash, updated_at=datetime('now'), last_changed_at=datetime('now')").run(ownerId, ownerPasswordHash);
        // Revoke copied credentials for every other local fixture without removing its data.
        copy.prepare('DELETE FROM user_passwords WHERE user_id != ?').run(ownerId);
        copy.exec('DELETE FROM account; DELETE FROM session; DELETE FROM verificationToken; DELETE FROM auth_tokens; DELETE FROM auth_rate_limits; UPDATE user SET token_version = token_version + 1');
      })();
    }
    const after = databaseSummary(copy);
    for (const name of catalogueTables) {
      if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) throw new Error(`Catalogue table ${name} changed unexpectedly.`);
    }
    if (mode === 'full') {
      for (const name of ['itinerary_legs', 'itinerary_leg_transports', 'expenses', 'saved_plans', 'fixed_costs', 'tags', 'expense_tags', 'user_preferences']) {
        if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) throw new Error(`Personal table ${name} changed unexpectedly.`);
      }
    }
    // Remove deleted credentials/private pages from the distributable SQLite file.
    copy.pragma('wal_checkpoint(TRUNCATE)');
    copy.pragma('journal_mode = DELETE');
    copy.exec('VACUUM');
    checkDatabase(copy);
    copy.close(); copy = undefined;
    files['travel.db'] = { bytes: statSync(target).size, sha256: hashFile(target) };
    const analyticsFile = analyticsSource || path.join(path.dirname(source), 'analytics.db');
    if (mode === 'full' && existsSync(analyticsFile)) {
      const analytics = new Database(analyticsFile, { readonly: true, fileMustExist: true });
      try {
        if (analytics.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Analytics database integrity check failed.');
        await analytics.backup(path.join(destination, 'analytics.db'));
        const copied = path.join(destination, 'analytics.db');
        files['analytics.db'] = { bytes: statSync(copied).size, sha256: hashFile(copied) };
      } finally { analytics.close(); }
    }
    const manifest = { version: 1, mode, createdAt: new Date().toISOString(), ownerProvisioned: Boolean(ownerEmail), tables: after, files };
    writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    return manifest;
  } finally {
    copy?.close();
    original.close();
  }
}

export function verifyDataSnapshot(directory) {
  directory = path.resolve(directory);
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !manifest.files?.['travel.db']) throw new Error('Unsupported or incomplete snapshot manifest.');
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = path.resolve(directory, name);
    if (!file.startsWith(directory + path.sep)) throw new Error('Unsafe manifest path.');
    if (statSync(file).size !== expected.bytes || hashFile(file) !== expected.sha256) throw new Error(`Snapshot checksum mismatch: ${name}`);
  }
  if (manifest.files['analytics.db']) {
    if (manifest.mode !== 'full') throw new Error('Catalogue snapshot includes analytics data.');
    const analytics = new Database(path.join(directory, 'analytics.db'), { readonly: true, fileMustExist: true });
    try { if (analytics.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Analytics database integrity check failed.'); }
    finally { analytics.close(); }
  }
  const db = new Database(path.join(directory, 'travel.db'), { readonly: true, fileMustExist: true });
  try {
    checkDatabase(db);
    if (JSON.stringify(databaseSummary(db)) !== JSON.stringify(manifest.tables)) throw new Error('Snapshot row hashes do not match.');
    for (const row of db.prepare("SELECT large_file, small_file FROM city_images WHERE status='ok'").all()) {
      for (const name of [row.large_file, row.small_file]) {
        if (!name || !manifest.files['city-images/' + name]) throw new Error('Snapshot manifest omits a referenced city image.');
        imagePath(path.join(directory, 'city-images'), name);
      }
    }
    if (manifest.mode === 'catalogue') for (const [name, value] of Object.entries(manifest.tables)) {
      if (!catalogueTables.has(name) && value.count !== 0) throw new Error('Catalogue snapshot includes personal data.');
    }
    return manifest;
  } finally { db.close(); }
}

export function restoreDataSnapshot(source, destination) {
  const manifest = verifyDataSnapshot(source);
  destination = path.resolve(destination);
  if (existsSync(destination)) throw new Error('Restore destination already exists. Restore into a new directory, then switch the stopped app to it.');
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const name of [...Object.keys(manifest.files), 'manifest.json']) {
    const target = path.join(destination, name);
    mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    copyFileSync(path.join(source, name), target);
  }
  return verifyDataSnapshot(destination);
}
