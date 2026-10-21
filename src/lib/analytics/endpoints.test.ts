import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as null | { id: string; email: string } }));
vi.mock('@/db', async () => (await import('./test-fixture')).analyticsTestDatabase());
vi.mock('@/lib/auth', () => {
  class AuthRequiredError extends Error { status = 401; }
  return { AuthRequiredError, getAuthSession: async () => state.user ? { user: state.user } : null,
    requireCurrentUser: async () => { if (!state.user) throw new AuthRequiredError(); return state.user; } };
});
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ allowed: true }) }));
import { sqlite } from '@/db';
import { POST as collect } from '@/app/api/analytics/events/route';
import { GET as readPreference, PUT as writePreference } from '@/app/api/settings/analytics/route';
import { GET as report } from '@/app/api/admin/analytics/route';
const browserEvent = () => ({ id: crypto.randomUUID(), name: 'page_viewed', version: 1, occurredAt: new Date().toISOString(), sessionId: crypto.randomUUID(), pageViewId: crypto.randomUUID(), route: '/plan', properties: {} });
function request(path: string, data: unknown, method = 'POST') {
  return new Request('http://localhost' + path, { method, headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
beforeEach(() => {
  state.user = { id: 'guest', email: 'guest@example.test' };
  sqlite.exec("DELETE FROM analytics_outbox; DELETE FROM analytics_preferences; INSERT OR IGNORE INTO user(id) VALUES ('guest');");
  vi.stubEnv('AUTH_ADMIN_EMAILS', 'owner@example.test'); vi.stubEnv('AUTH_ANALYTICS_ADMIN_EMAILS', '');
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => sqlite.close());
describe('analytics endpoint boundaries', () => {
  it('honors saved opt-out when a stale browser submits a valid batch', async () => {
    expect((await writePreference(request('/api/settings/analytics', { enabled: false }, 'PUT'))).status).toBe(200);
    expect((await (await readPreference(new Request('http://localhost/api/settings/analytics'))).json()).data.enabled).toBe(false);
    expect((await collect(request('/api/analytics/events', { events: [browserEvent()] }))).status).toBe(204);
    expect(sqlite.prepare('SELECT count(*) AS n FROM analytics_outbox').get()).toEqual({ n: 0 });
  });
  it('derives account identity on the server and rejects forged event fields and cross-origin batches', async () => {
    const item = browserEvent();
    expect((await collect(request('/api/analytics/events', { events: [item] }))).status).toBe(204);
    const row = sqlite.prepare('SELECT user_id,payload_json FROM analytics_outbox').get() as { user_id: string; payload_json: string };
    expect(row.user_id).toBe('guest'); expect(JSON.parse(row.payload_json).accountId).toMatch(/^[a-f0-9]{64}$/);
    expect((await collect(request('/api/analytics/events', { events: [{ ...item, accountId: 'owner' }] }))).status).toBe(400);
    expect((await collect(new Request('http://localhost/api/analytics/events', { method: 'POST', headers: { Origin: 'https://different.example', Host: 'localhost' }, body: '{}' }))).status).toBe(403);
  });
  it('refuses non-admin access to reports and full private revisions', async () => {
    for (const query of ['view=overview', 'view=plans&revision=1', 'view=plans&revision=1&export=true']) expect((await report(new Request('http://localhost/api/admin/analytics?' + query))).status).toBe(403);
    state.user = null;
    expect((await report(new Request('http://localhost/api/admin/analytics'))).status).toBe(401);
  });
  it('rejects oversized bodies before JSON ingestion', async () => {
    const response = await collect(request('/api/analytics/events', { invalid: 'a'.repeat(66000) }));
    expect(response.status).toBe(413);
  });
});
