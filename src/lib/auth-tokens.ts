import { createHash, randomBytes } from 'crypto';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { db, sqlite } from '@/db';
import { authTokens } from '@/db/schema';

export type TokenPurpose = 'verify_email' | 'reset_password';

const DEFAULT_TTL_MINUTES: Record<TokenPurpose, number> = {
  verify_email: 60 * 24,
  reset_password: 30,
};

export interface IssueTokenOptions {
  ttlMinutes?: number;
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedToken {
  rawToken: string;
  id: string;
  expiresAt: Date;
}

function hashRawToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function toSqliteTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  options: IssueTokenOptions = {}
): Promise<IssuedToken> {
  const ttlMinutes = options.ttlMinutes ?? DEFAULT_TTL_MINUTES[purpose];
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashRawToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const id = crypto.randomUUID();

  await db.insert(authTokens).values({
    id,
    userId,
    purpose,
    tokenHash,
    expiresAt: toSqliteTimestamp(expiresAt),
    ip: options.ip ?? null,
    userAgent: options.userAgent ?? null,
  });

  return { rawToken, id, expiresAt };
}

export async function consumeToken(
  rawToken: string,
  purpose: TokenPurpose
): Promise<{ userId: string } | null> {
  return consumeTokenSync(rawToken, purpose);
}

/** Synchronous so consumption and the protected write share one SQLite transaction. */
export function consumeTokenSync(rawToken: string, purpose: TokenPurpose): { userId: string } | null {
  if (!rawToken) return null;
  const tokenHash = hashRawToken(rawToken);
  const nowStamp = toSqliteTimestamp(new Date());

  const row = sqlite.prepare(`
    UPDATE auth_tokens SET consumed_at = ?
    WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
    RETURNING user_id AS userId
  `).get(nowStamp, tokenHash, purpose, nowStamp) as { userId: string } | undefined;
  return row ?? null;
}

export async function invalidateUserTokens(userId: string, purpose: TokenPurpose): Promise<void> {
  await db
    .update(authTokens)
    .set({ consumedAt: toSqliteTimestamp(new Date()) })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.consumedAt)
      )
    )
    .run();
}

export async function purgeExpiredTokens(olderThan: Date = new Date()): Promise<number> {
  const cutoff = toSqliteTimestamp(olderThan);
  const result = await db
    .delete(authTokens)
    .where(lte(authTokens.expiresAt, cutoff))
    .run();
  return result.changes;
}
