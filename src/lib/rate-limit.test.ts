import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authRateLimits } from '@/db/schema';

type RateLimitModule = typeof import('@/lib/rate-limit');
type DbModule = typeof import('@/db');

let dbModule: DbModule;
let rateLimitModule: RateLimitModule;
let tempDir: string;
const originalCwd = process.cwd();

describe.sequential('rate limit helper', () => {
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wanderledger-rate-limit-'));
    process.chdir(tempDir);
    vi.resetModules();

    dbModule = await import('@/db');
    rateLimitModule = await import('@/lib/rate-limit');
  });

  afterAll(() => {
    dbModule?.sqlite.close();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
    await dbModule.db.delete(authRateLimits);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first call in a fresh bucket', async () => {
    await expect(
      rateLimitModule.checkRateLimit('signup:ip:1.2.3.4', { max: 5, windowSeconds: 60 })
    ).resolves.toEqual({ allowed: true });
  });

  it('increments the bucket and blocks once the max is exceeded', async () => {
    await expect(
      rateLimitModule.checkRateLimit('login:email:test@example.com', { max: 2, windowSeconds: 60 })
    ).resolves.toEqual({ allowed: true });
    await expect(
      rateLimitModule.checkRateLimit('login:email:test@example.com', { max: 2, windowSeconds: 60 })
    ).resolves.toEqual({ allowed: true });

    const blocked = await rateLimitModule.checkRateLimit('login:email:test@example.com', {
      max: 2,
      windowSeconds: 60,
    });

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  it('resets the bucket after the window rolls over', async () => {
    await rateLimitModule.checkRateLimit('reset-password:ip:1.2.3.4', {
      max: 1,
      windowSeconds: 30,
    });
    await expect(
      rateLimitModule.checkRateLimit('reset-password:ip:1.2.3.4', {
        max: 1,
        windowSeconds: 30,
      })
    ).resolves.toMatchObject({ allowed: false });

    vi.setSystemTime(new Date('2026-04-17T00:00:31.000Z'));

    await expect(
      rateLimitModule.checkRateLimit('reset-password:ip:1.2.3.4', {
        max: 1,
        windowSeconds: 30,
      })
    ).resolves.toEqual({ allowed: true });
  });

  it("keeps different buckets isolated", async () => {
    await expect(
      rateLimitModule.checkRateLimit('signup:ip:bucket-a', { max: 1, windowSeconds: 60 })
    ).resolves.toEqual({ allowed: true });
    await expect(
      rateLimitModule.checkRateLimit('signup:ip:bucket-b', { max: 1, windowSeconds: 60 })
    ).resolves.toEqual({ allowed: true });
  });

  it('never returns retry-after below one second', async () => {
    await rateLimitModule.checkRateLimit('verify-email:ip:1.2.3.4', {
      max: 1,
      windowSeconds: 10,
    });

    vi.setSystemTime(new Date('2026-04-17T00:00:09.999Z'));

    const blocked = await rateLimitModule.checkRateLimit('verify-email:ip:1.2.3.4', {
      max: 1,
      windowSeconds: 10,
    });

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBe(1);
    }
  });
});
