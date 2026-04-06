import { db } from '@/db';
import { cities } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { id } = params;

    const existing = await db.select().from(cities).where(eq(cities.id, id)).get();
    if (!existing) return error('City not found', 404);

    await db.update(cities).set(body).where(eq(cities.id, id));
    const updated = await db.select().from(cities).where(eq(cities.id, id)).get();

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}
