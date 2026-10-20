import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, userPasswords, users } from '@/db/schema';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { hashPassword, verifyPassword } from '@/lib/password';

let dummyHashPromise: Promise<string> | null = null;

/**
 * Runs one Argon2 verification against a throwaway hash, so a sign-in for an address with no
 * account or no password takes as long as one with a wrong password and does not reveal which
 * allowlisted addresses have registered.
 */
async function spendEquivalentVerification(password: string) {
  dummyHashPromise ??= hashPassword(crypto.randomUUID());
  try {
    await verifyPassword(await dummyHashPromise, password);
  } catch {
    dummyHashPromise = null;
  }
}

export type NativeAuthResult =
  | {
      kind: 'ok';
      user: {
        id: string;
        email: string | null;
        name: string | null;
        image: string | null;
      };
    }
  | { kind: 'invalid' }
  | { kind: 'link-required-password' }
  | { kind: 'unverified' };

export async function verifyEmailPasswordCredentials(
  rawEmail: unknown,
  rawPassword: unknown
): Promise<NativeAuthResult> {
  if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
    return { kind: 'invalid' };
  }
  const email = normalizeEmail(rawEmail);
  if (!rawPassword || !isValidEmailShape(email)) {
    return { kind: 'invalid' };
  }

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) {
    await spendEquivalentVerification(rawPassword);
    return { kind: 'invalid' };
  }

  const stored = await db
    .select({ hash: userPasswords.hash })
    .from(userPasswords)
    .where(eq(userPasswords.userId, user.id))
    .get();

  if (!stored) {
    await spendEquivalentVerification(rawPassword);
    const googleAccount = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')))
      .get();

    if (googleAccount) {
      return { kind: 'link-required-password' };
    }

    return { kind: 'invalid' };
  }

  const passwordOk = await verifyPassword(stored.hash, rawPassword);
  if (!passwordOk) {
    return { kind: 'invalid' };
  }

  if (!user.emailVerified) {
    return { kind: 'unverified' };
  }

  return {
    kind: 'ok',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
  };
}

export const NATIVE_AUTH_ERROR_CODES = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  LINK_REQUIRED_PASSWORD: 'LINK_REQUIRED_PASSWORD',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;
