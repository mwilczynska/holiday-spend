import { db } from '@/db';
import { expenseTags, expenses, tags } from '@/db/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { error } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { z } from 'zod';

const selectionSchema = z.object({ tagIds: z.array(z.number().int().positive()).max(500) });
const expenseIdSchema = z.coerce.number().int().positive();

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireCurrentUserId();
    const expenseId = expenseIdSchema.parse(params.id);
    const expense = db.select({ id: expenses.id }).from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId), ne(expenses.isDeleted, 1))).get();
    if (!expense) return error('Expense not found', 404);
    const availableTags = db.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.userId, userId)).all();
    const assignedTags = db.select({ id: tags.id }).from(expenseTags)
      .innerJoin(tags, eq(expenseTags.tagId, tags.id))
      .where(and(eq(expenseTags.expenseId, expenseId), eq(tags.userId, userId))).all();
    return success({ tags: availableTags, tagIds: assignedTags.map(tag => tag.id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireCurrentUserId();
    const expenseId = expenseIdSchema.parse(params.id);
    const { tagIds } = selectionSchema.parse(await request.json());
    const selectedIds = Array.from(new Set(tagIds));
    const expense = db.select({ id: expenses.id }).from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId), ne(expenses.isDeleted, 1))).get();
    if (!expense) return error('Expense not found', 404);
    const ownedTags = db.select({ id: tags.id }).from(tags).where(eq(tags.userId, userId)).all();
    const ownedIds = ownedTags.map(tag => tag.id);
    if (selectedIds.some(id => !ownedIds.includes(id))) return error('Tag not found. Reload the tags and try again.', 404);
    db.transaction(tx => {
      if (ownedIds.length) tx.delete(expenseTags)
        .where(and(eq(expenseTags.expenseId, expenseId), inArray(expenseTags.tagId, ownedIds))).run();
      if (selectedIds.length) tx.insert(expenseTags).values(selectedIds.map(tagId => ({ expenseId, tagId }))).run();
    });
    return success({ tagIds: selectedIds });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const { tagIds } = z.object({ tagIds: z.array(z.number()) }).parse(body);
    const expenseId = parseInt(params.id);

    const expense = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
      .get();
    if (!expense) return error('Expense not found', 404);

    const ownedTags = tagIds.length > 0
      ? await db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)))
      : [];

    for (const tagId of ownedTags.map((tag) => tag.id)) {
      await db.insert(expenseTags).values({ expenseId, tagId }).onConflictDoNothing();
    }

    return success({ added: ownedTags.length });
  } catch (err) {
    return handleError(err);
  }
}
