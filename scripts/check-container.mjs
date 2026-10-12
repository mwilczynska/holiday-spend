// Linux Docker smoke test. Uses only disposable CSV/test-account data, never deployment secrets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const image = process.env.HOLIDAY_SPEND_TEST_IMAGE || 'holiday-spend:ci';
const seedImage = process.env.HOLIDAY_SPEND_TEST_SEED_IMAGE || 'holiday-spend:ci-seed';
const name = 'holiday-spend-smoke-' + randomBytes(5).toString('hex');
const directory = mkdtempSync(path.join(os.tmpdir(), name));
const environment = path.join(directory, 'runtime.env');
const volume = name + '-data';
const backupVolume = name + '-backups';
const password = 'Disposable-container-test-123';
writeFileSync(environment, [
  'NEXTAUTH_SECRET=' + randomBytes(48).toString('hex'),
  'APP_URL=https://spend.example.com', 'NEXTAUTH_URL=https://spend.example.com',
  'HOLIDAY_SPEND_DB_PATH=/app/data/travel.db', 'HOLIDAY_SPEND_REQUIRE_DATABASE=true',
  'HOLIDAY_SPEND_TRUST_PROXY=true', 'AUTH_ALLOWED_EMAILS=owner@example.com,guest@example.com',
  'AUTH_ADMIN_EMAILS=owner@example.com', 'ENABLE_EMAIL_PASSWORD=true',
  // No email-send route is called; this synthetic key is never transmitted.
  'RESEND_API_KEY=re_disposable_smoke_test', 'MAIL_FROM=Holiday Spend <account@auth.example.com>',
].join('\n'), { mode: 0o600 });

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function runCode(code) { return docker('exec', name, 'node', '-e', code); }
let base;
const cookies = new Map();
async function request(route, options = {}) {
  const response = await fetch(base + route, {
    ...options, redirect: 'manual',
    headers: { Host: 'spend.example.com', 'X-Forwarded-Proto': 'https', 'X-Real-IP': '127.0.0.1',
      Cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; '), ...options.headers },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const split = pair.indexOf('=');
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  return response;
}
async function ready() {
  let lastFailure = 'No response';
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await request('/api/health');
      if (response.ok) return;
      lastFailure = 'HTTP ' + response.status;
    } catch (error) { lastFailure = error.cause?.code || error.message; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Container never became ready: ' + lastFailure);
}
try {
  docker('volume', 'create', volume);
  docker('volume', 'create', backupVolume);
  docker('run', '--rm', '-v', volume + ':/app/data', '-e', 'HOLIDAY_SPEND_DB_PATH=/app/data/travel.db', seedImage);
  docker('run', '--rm', '--user', '0', '-v', volume + ':/app/data', '--entrypoint', 'chown', image, '-R', '1001:1001', '/app/data');
  docker('run', '--rm', '--user', '0', '-v', backupVolume + ':/backups', '--entrypoint', 'chown', image, '-R', '1001:1001', '/backups');
  assert.throws(() => docker('run', '--rm', '--env-file', environment, image), /Command failed/, 'An image without a restored database must refuse startup.');
  docker('run', '-d', '--name', name, '--env-file', environment, '-v', volume + ':/app/data', '-p', '127.0.0.1::3000', image);
  const port = docker('port', name, '3000/tcp').split(':').at(-1);
  base = 'http://127.0.0.1:' + port;
  await ready();
  assert.equal((await request('/api/cities')).status, 401);
  assert.equal((await request('/plan')).status, 307);
  const login = await request('/login');
  assert.equal(login.status, 200);
  const html = await login.text();
  const asset = html.match(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/)?.[1];
  assert.ok(asset, 'Login must reference built static assets.');
  assert.equal((await request(asset)).status, 200);
  runCode(`const fs=require('node:fs'); for(const file of ['llm_prompt_new_cities_1.md','llm_prompt_new_cities_v1_1.md','llm_prompt_intercity_transport_1.md','llm_prompt_intercity_transport_v1_1.md']) if(!fs.existsSync('docs/prompts/'+file)) throw Error(file);`);
  // Real Linux Argon2 and SQLite bindings, plus real NextAuth cookies and revocation.
  runCode(`(async()=>{const db=new(require('better-sqlite3'))('/app/data/travel.db');const hash=await require('argon2').hash('${password}');for(const who of ['owner','guest']){db.prepare('INSERT INTO user (id,email,emailVerified) VALUES (?,?,?)').run(who,who+'@example.com',new Date().toISOString());db.prepare('INSERT INTO user_passwords (user_id,hash) VALUES (?,?)').run(who,hash);}db.close();})().catch(e=>{console.error(e.message);process.exit(1)});`);
  async function signIn(email) {
    cookies.clear();
    const { csrfToken } = await (await request('/api/auth/csrf')).json();
    await request('/api/auth/callback/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: 'https://spend.example.com/', json: 'true' }),
    });
    const session = await (await request('/api/auth/session')).json();
    assert.equal(session.user?.email, email, 'NextAuth must establish the expected session.');
  }
  await signIn('owner@example.com');
  const cities = await (await request('/api/cities')).json();
  assert.equal(cities.data?.length, 121);
  assert.equal((await request('/plan')).status, 200);
  await signIn('guest@example.com');
  assert.equal((await request('/api/cities')).status, 200);
  assert.equal((await request('/api/countries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  runCode("const db=new(require('better-sqlite3'))('/app/data/travel.db');db.prepare('UPDATE user SET token_version=token_version+1 WHERE id=?').run('guest');db.close();");
  assert.equal((await request('/api/cities')).status, 401);
  // Match Compose's production helper: read-only source, separate writable backup storage.
  docker('run', '--rm', '-v', volume + ':/app/data:ro', '-v', backupVolume + ':/backups', '--entrypoint', 'node', image,
    'scripts/backup.mjs', '--destination', '/backups/snapshot');
  docker('run', '--rm', '-v', backupVolume + ':/backups', '--entrypoint', 'node', image,
    'scripts/backup.mjs', '--restore-from', '/backups/snapshot', '--destination', '/backups/restored');
  docker('restart', name);
  // Docker may allocate a different host port when an ephemeral binding restarts.
  base = 'http://127.0.0.1:' + docker('port', name, '3000/tcp').split(':').at(-1);
  await ready();
  assert.equal((await request('/api/cities')).status, 401);
  await signIn('owner@example.com');
  assert.equal((await (await request('/api/cities')).json()).data?.length, 121);
  console.log('Linux container, native modules, prompts/assets, auth, permissions, revocation, backup/restore and restart checks passed.');
} catch (error) {
  try { console.error(docker('logs', name)); } catch {}
  throw error;
} finally {
  try { docker('rm', '-f', name); } catch {}
  try { docker('volume', 'rm', volume); } catch {}
  try { docker('volume', 'rm', backupVolume); } catch {}
  rmSync(directory, { recursive: true, force: true });
}
