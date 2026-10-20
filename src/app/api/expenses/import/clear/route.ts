import { instrumentRoute } from '@/lib/analytics/route';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

async function handleDELETE() {
  try {
    const userId = await requireCurrentUserId();
    const deleted = await db.delete(expenses).where(and(eq(expenses.userId, userId), eq(expenses.source, 'wise_csv'))).returning({ id: expenses.id });
    return success({ deleted: deleted.length });
  } catch (err) {
    return handleError(err);
  }
}

export const DELETE = instrumentRoute(handleDELETE, '/api/expenses/import/clear', 'DELETE');
