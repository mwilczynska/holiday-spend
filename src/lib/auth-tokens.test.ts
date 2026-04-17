import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authTokens, users } from '@/db/schema';

type AuthTokensModule = typeof import('@/lib/auth-tokens');
type DbModule = typeof import('@/db');

let dbModule: DbModule;
let authTokensModule: AuthTokensModule;
let tempDir: string;
const originalCwd = process.cwd();

function hashRawToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

describe.sequential('auth token helpers', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wanderledger-auth-tokens-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    authTokensModule = await import('@/lib/auth-tokens');
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await dbModule.db.delete(authTokens);
    await dbModule.db.delete(users);
    await dbModule.db.insert(users).values({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: null,
      image: null,
      tokenVersion: 0,
    });
  });

  it('issues an opaque token and persists only a sha256 hex hash', async () => {
    const issued = await authTokensModule.issueToken('user-1', 'verify_email', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(issued.rawToken).toHaveLength(43);

    const row = await dbModule.db
      .select({
        id: authTokens.id,
        tokenHash: authTokens.tokenHash,
        purpose: authTokens.purpose,
        userId: authTokens.userId,
      })
      .from(authTokens)
      .where(eq(authTokens.id, issued.id))
      .get();

    expect(row).toEqual({
      id: issued.id,
      tokenHash: hashRawToken(issued.rawToken),
      purpose: 'verify_email',
      userId: 'user-1',
    });
    expect(row?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('consumes a fresh token exactly once', async () => {
    const issued = await authTokensModule.issueToken('user-1', 'verify_email');

    await expect(authTokensModule.consumeToken(issued.rawToken, 'verify_email')).resolves.toEqual({
      userId: 'user-1',
    });
    await expect(authTokensModule.consumeToken(issued.rawToken, 'verify_email')).resolves.toBeNull();
  });

  it('returns null for expired tokens', async () => {
    const issued = await authTokensModule.issueToken('user-1', 'reset_password', {
      ttlMinutes: -1,
    });

    await expect(authTokensModule.consumeToken(issued.rawToken, 'reset_password')).resolves.toBeNull();
  });

  it('returns null when the purpose does not match', async () => {
    const issued = await authTokensModule.issueToken('user-1', 'verify_email');

    await expect(authTokensModule.consumeToken(issued.rawToken, 'reset_password')).resolves.toBeNull();
  });

  it('invalidates all unconsumed tokens for a user and purpose', async () => {
    const first = await authTokensModule.issueToken('user-1', 'verify_email');
    const second = await authTokensModule.issueToken('user-1', 'verify_email');
    const otherPurpose = await authTokensModule.issueToken('user-1', 'reset_password');

    await authTokensModule.invalidateUserTokens('user-1', 'verify_email');

    await expect(authTokensModule.consumeToken(first.rawToken, 'verify_email')).resolves.toBeNull();
    await expect(authTokensModule.consumeToken(second.rawToken, 'verify_email')).resolves.toBeNull();
    await expect(authTokensModule.consumeToken(otherPurpose.rawToken, 'reset_password')).resolves.toEqual({
      userId: 'user-1',
    });
  });
});
