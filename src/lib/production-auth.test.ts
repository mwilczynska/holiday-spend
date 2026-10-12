import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  verification: vi.fn(async (_email: string, _url: string) => {}),
  reset: vi.fn(async (_email: string, _url: string) => {}),
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => state.session) }));
vi.mock('@/lib/mailer', () => ({
  sendVerificationEmail: state.verification,
  sendPasswordResetEmail: state.reset,
  isMailConfigured: () => true,
}));

let database: typeof import('@/db');
let auth: typeof import('@/lib/auth');
let tokens: typeof import('@/lib/auth-tokens');
let native: typeof import('@/lib/native-auth');
let signup: typeof import('@/app/api/auth/signup/route');
let verify: typeof import('@/app/api/auth/verify-email/route');
let forgot: typeof import('@/app/api/auth/forgot-password/route');
let reset: typeof import('@/app/api/auth/reset-password/route');
let change: typeof import('@/app/api/auth/change-password/route');
let resend: typeof import('@/app/api/auth/resend-verification/route');
let library: typeof import('@/lib/library-auth');
let temp: string;

function post(body: unknown) {
  return new Request('https://spend.example.com/api/auth/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '127.0.0.1' },
    body: JSON.stringify(body),
  });
}
function sentToken(mock: typeof state.verification) {
  const calls = mock.mock.calls;
  return new URL(calls[calls.length - 1][1]).searchParams.get('token')!;
}
async function register() {
  expect((await signup.POST(post({ email: 'owner@example.com', password: 'First-password-123' }))).status).toBe(200);
  return database.sqlite.prepare('SELECT id FROM user WHERE email=?').get('owner@example.com') as { id: string };
}
async function jwt(token: JWT) {
  const callback = auth.authOptions.callbacks!.jwt!;
  return callback({ token } as Parameters<typeof callback>[0]);
}

// These integration cases exercise real Argon2 hashes several times per flow.
describe.sequential('production email/password authentication', { timeout: 20000 }, () => {
  beforeAll(async () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-production-auth-'));
    vi.stubEnv('HOLIDAY_SPEND_DB_PATH', path.join(temp, 'travel.db'));
    vi.stubEnv('HOLIDAY_SPEND_REQUIRE_DATABASE', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_EMAIL_PASSWORD', 'true');
    vi.stubEnv('AUTH_ALLOWED_EMAILS', 'owner@example.com,guest@example.com');
    vi.stubEnv('AUTH_ADMIN_EMAILS', 'owner@example.com');
    vi.stubEnv('AUTH_DEV_PIN', 'test-pin-must-not-work');
    vi.stubEnv('APP_URL', 'https://spend.example.com');
    vi.stubEnv('HOLIDAY_SPEND_TRUST_PROXY', 'true');
    vi.resetModules();
    database = await import('@/db');
    auth = await import('@/lib/auth');
    tokens = await import('@/lib/auth-tokens');
    native = await import('@/lib/native-auth');
    signup = await import('@/app/api/auth/signup/route');
    verify = await import('@/app/api/auth/verify-email/route');
    forgot = await import('@/app/api/auth/forgot-password/route');
    reset = await import('@/app/api/auth/reset-password/route');
    change = await import('@/app/api/auth/change-password/route');
    resend = await import('@/app/api/auth/resend-verification/route');
    library = await import('@/lib/library-auth');
  }, 60000);
  beforeEach(() => {
    database.sqlite.exec('DELETE FROM auth_tokens; DELETE FROM auth_rate_limits; DELETE FROM user_passwords; DELETE FROM user_preferences; DELETE FROM account; DELETE FROM session; DELETE FROM user;');
    state.session = null;
    state.verification.mockReset();
    state.reset.mockReset();
  });
  afterAll(() => {
    database?.sqlite.close();
    vi.unstubAllEnvs();
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it('requires the private allowlist and never enables the production PIN', async () => {
    expect(auth.getConfiguredAuthProviders().devPin).toBe(false);
    const result = await signup.POST(post({ email: 'stranger@example.com', password: 'A-good-password-123' }));
    expect(result.status).toBe(403);
    expect(database.sqlite.prepare('SELECT count(*) AS n FROM user').get()).toEqual({ n: 0 });
    expect(state.verification).not.toHaveBeenCalled();
    await forgot.POST(post({ email: 'stranger@example.com' }));
    expect(state.reset).not.toHaveBeenCalled();
    const policy = await import('@/lib/auth-policy');
    vi.stubEnv('AUTH_ALLOWED_EMAILS', '');
    expect(policy.isEmailAllowed('owner@example.com')).toBe(false);
    vi.stubEnv('AUTH_ALLOWED_EMAILS', 'owner@example.com,guest@example.com');
  });

  it('signs up, blocks unverified/wrong passwords and verifies a single-use link', async () => {
    await register();
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'wrong-password')).kind).toBe('invalid');
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'First-password-123')).kind).toBe('unverified');
    expect(state.verification.mock.calls[0][1]).toMatch(/^https:\/\/spend.example.com\/verify-email\?token=/);
    const token = sentToken(state.verification);
    expect((await verify.POST(post({ token }))).status).toBe(200);
    expect((await verify.POST(post({ token }))).status).toBe(400);
    expect((await native.verifyEmailPasswordCredentials(' OWNER@example.com ', 'First-password-123')).kind).toBe('ok');
  });

  it('recovers from failed verification delivery without replacing the existing password', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.verification.mockRejectedValueOnce(new Error('Simulated delivery failure'));
    expect((await signup.POST(post({ email: 'owner@example.com', password: 'First-password-123' }))).status).toBe(500);
    const oldToken = sentToken(state.verification);
    expect((await signup.POST(post({ email: 'owner@example.com', password: 'Different-password-123' }))).status).toBe(200);
    expect((await verify.POST(post({ token: oldToken }))).status).toBe(400);
    expect((await verify.POST(post({ token: sentToken(state.verification) }))).status).toBe(200);
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'First-password-123')).kind).toBe('ok');
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'Different-password-123')).kind).toBe('invalid');
    logger.mockRestore();
  });

  it('resends verification, expires prior links and rate limits repeated requests', async () => {
    const user = await register();
    const expired = await tokens.issueToken(user.id, 'verify_email', { ttlMinutes: -1 });
    expect((await verify.POST(post({ token: expired.rawToken }))).status).toBe(400);
    const first = sentToken(state.verification);
    expect((await resend.POST(post({ email: 'owner@example.com' }))).status).toBe(200);
    expect((await verify.POST(post({ token: first }))).status).toBe(400);
    expect((await resend.POST(post({ email: 'owner@example.com' }))).status).toBe(200);
    expect((await resend.POST(post({ email: 'owner@example.com' }))).status).toBe(200);
    const limited = await resend.POST(post({ email: 'owner@example.com' }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('resets a password once and revokes existing sessions and other account tokens', async () => {
    const user = await register();
    await verify.POST(post({ token: sentToken(state.verification) }));
    const oldSession: JWT = { sub: user.id, email: 'owner@example.com', tokenVersion: 0 };
    expect((await jwt(oldSession)).sub).toBe(user.id);
    expect((await forgot.POST(post({ email: 'owner@example.com' }))).status).toBe(200);
    const first = sentToken(state.reset);
    await forgot.POST(post({ email: 'owner@example.com' }));
    const latest = sentToken(state.reset);
    expect((await reset.POST(post({ token: first, newPassword: 'Second-password-123' }))).status).toBe(400);
    expect((await reset.POST(post({ token: latest, newPassword: 'Second-password-123' }))).status).toBe(200);
    expect((await reset.POST(post({ token: latest, newPassword: 'Third-password-123' }))).status).toBe(400);
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'Second-password-123')).kind).toBe('ok');
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'First-password-123')).kind).toBe('invalid');
    expect(await jwt(oldSession)).toEqual({});
  });

  it('rolls token consumption back when the password write fails', async () => {
    const user = await register();
    const issued = await tokens.issueToken(user.id, 'reset_password');
    database.sqlite.prepare('DELETE FROM user_passwords WHERE user_id=?').run(user.id);
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await reset.POST(post({ token: issued.rawToken, newPassword: 'Second-password-123' }))).status).toBe(500);
    expect(tokens.consumeTokenSync(issued.rawToken, 'reset_password')).toEqual({ userId: user.id });
    logger.mockRestore();
  });

  it('changes passwords only with the current password and revokes sessions', async () => {
    const user = await register();
    await verify.POST(post({ token: sentToken(state.verification) }));
    state.session = { user: { id: user.id, email: 'owner@example.com' } };
    expect((await change.POST(post({ currentPassword: 'wrong', newPassword: 'Second-password-123' }))).status).toBe(400);
    expect((await change.POST(post({ currentPassword: 'First-password-123', newPassword: 'Second-password-123' }))).status).toBe(200);
    expect(await jwt({ sub: user.id, email: 'owner@example.com', tokenVersion: 0 })).toEqual({});
    expect((await native.verifyEmailPasswordCredentials('owner@example.com', 'Second-password-123')).kind).toBe('ok');
  });

  it('allows guests to sign in without giving them shared-library write access', async () => {
    state.session = { user: { id: 'guest', email: 'guest@example.com' } };
    expect(await auth.requireCurrentUserId()).toBe('guest');
    await expect(library.requireLibraryAdmin()).rejects.toMatchObject({ status: 403 });
    state.session = { user: { id: 'owner', email: 'owner@example.com' } };
    expect(await library.requireLibraryAdmin()).toBe('owner');
    state.session = { user: { id: 'removed', email: 'removed@example.com' } };
    await expect(auth.requireCurrentUserId()).rejects.toMatchObject({ status: 401 });
  });
});
