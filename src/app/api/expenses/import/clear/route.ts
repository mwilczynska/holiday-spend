import { db } from '@/db';
import { expenses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';

export async function DELETE() {
  try {
    const deleted = await db.delete(expenses).where(eq(expenses.source, 'wise_csv')).returning({ id: expenses.id });
    return success({ deleted: deleted.length });
  } catch (err) {
    return handleError(err);
  }
}
