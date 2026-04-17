import { describe, expect, it } from 'vitest';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/password';

describe('password helpers', () => {
  it('hashes with argon2id and verifies the original password only', async () => {
    const password = 'correct-horse-battery-staple-42';
    const hash = await hashPassword(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, `${password}-wrong`)).resolves.toBe(false);
  });

  it('returns false for malformed hashes', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });

  it('rejects weak passwords and accepts a realistic strong one', () => {
    expect(validatePasswordStrength('')).toEqual({
      ok: false,
      reason: 'Password must be at least 10 characters.',
    });
    expect(validatePasswordStrength('short')).toEqual({
      ok: false,
      reason: 'Password must be at least 10 characters.',
    });
    expect(validatePasswordStrength('a'.repeat(257))).toEqual({
      ok: false,
      reason: 'Password must be at most 256 characters.',
    });
    expect(validatePasswordStrength('1234567890')).toEqual({
      ok: false,
      reason: 'Password cannot be only digits.',
    });
    expect(validatePasswordStrength('welcome123')).toEqual({
      ok: false,
      reason: 'That password is too common. Pick a less predictable one.',
    });
    expect(validatePasswordStrength('WELCOME123')).toEqual({
      ok: false,
      reason: 'That password is too common. Pick a less predictable one.',
    });
    expect(validatePasswordStrength('correct-horse-battery-staple-42')).toEqual({ ok: true });
  });
});
