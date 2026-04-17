import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 65536,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

export type PasswordStrengthResult = { ok: true } | { ok: false; reason: string };

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwerty123',
  'iloveyou',
  'letmein1',
  'welcome123',
  'admin1234',
]);

export function validatePasswordStrength(plaintext: string): PasswordStrengthResult {
  if (typeof plaintext !== 'string') {
    return { ok: false, reason: 'Password is required.' };
  }
  if (plaintext.length < 10) {
    return { ok: false, reason: 'Password must be at least 10 characters.' };
  }
  if (plaintext.length > 256) {
    return { ok: false, reason: 'Password must be at most 256 characters.' };
  }
  if (/^\d+$/.test(plaintext)) {
    return { ok: false, reason: 'Password cannot be only digits.' };
  }
  if (COMMON_PASSWORDS.has(plaintext.toLowerCase())) {
    return { ok: false, reason: 'That password is too common. Pick a less predictable one.' };
  }
  return { ok: true };
}
