import { sqlite } from '@/db';

type RateLimitAllowed = { allowed: true };
type RateLimitBlocked = { allowed: false; retryAfterSeconds: number };

function toSqliteTimestamp(date: Date) {
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

function clampRetryAfter(seconds: number) {
  return Math.max(1, Math.ceil(seconds));
}

const selectRateLimit = sqlite.prepare(`
  SELECT count, window_start as windowStart
  FROM auth_rate_limits
  WHERE bucket = ?
`);

const insertRateLimit = sqlite.prepare(`
  INSERT INTO auth_rate_limits (bucket, count, window_start, updated_at)
  VALUES (?, ?, ?, datetime('now'))
`);

const updateRateLimit = sqlite.prepare(`
  UPDATE auth_rate_limits
  SET count = ?, window_start = ?, updated_at = datetime('now')
  WHERE bucket = ?
`);

const checkRateLimitTx = sqlite.transaction(
  (bucket: string, max: number, windowSeconds: number): RateLimitAllowed | RateLimitBlocked => {
    const now = new Date();
    const row = selectRateLimit.get(bucket) as { count: number; windowStart: string } | undefined;

    if (!row) {
      insertRateLimit.run(bucket, 1, toSqliteTimestamp(now));
      return { allowed: true };
    }

    const windowStart = new Date(row.windowStart.replace(' ', 'T') + 'Z');
    const elapsedSeconds = (now.getTime() - windowStart.getTime()) / 1000;

    if (elapsedSeconds >= windowSeconds) {
      updateRateLimit.run(1, toSqliteTimestamp(now), bucket);
      return { allowed: true };
    }

    const nextCount = row.count + 1;
    if (nextCount > max) {
      updateRateLimit.run(nextCount, row.windowStart, bucket);
      return {
        allowed: false,
        retryAfterSeconds: clampRetryAfter(windowSeconds - elapsedSeconds),
      };
    }

    updateRateLimit.run(nextCount, row.windowStart, bucket);
    return { allowed: true };
  }
);

export async function checkRateLimit(
  bucket: string,
  opts: { max: number; windowSeconds: number }
): Promise<RateLimitAllowed | RateLimitBlocked> {
  return checkRateLimitTx(bucket, opts.max, opts.windowSeconds);
}
