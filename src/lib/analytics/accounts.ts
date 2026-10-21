import { sqlite } from '@/db';
import { accountAnalyticsId } from './service';

/**
 * Pseudonymous analytics account ID → account email, for analytics administrators.
 * Events stay pseudonymous in analytics.db; the email is looked up only when an admin report is
 * served, so an erased or deleted account simply stops resolving.
 */
export function accountDirectory(): Record<string, string> {
  const rows = sqlite.prepare('SELECT id, email FROM user').all() as Array<{ id: string; email: string | null }>;
  return Object.fromEntries(rows.filter(row => row.email).map(row => [accountAnalyticsId(row.id), row.email as string]));
}
