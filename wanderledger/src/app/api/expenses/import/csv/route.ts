import { db } from '@/db';
import { expenses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseWiseCsv } from '@/lib/wise-csv-parser';
import { convertToAud } from '@/lib/exchange-rates';
import { success, error, handleError } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const confirmImport = formData.get('confirm') === 'true';

    if (!file) return error('No file provided');

    const csvText = await file.text();
    const parsed = parseWiseCsv(csvText);

    // Check for duplicates
    const existingTxnIds = new Set<string>();
    for (const p of parsed) {
      if (p.wiseTxnId) {
        const existing = await db.select({ id: expenses.id })
          .from(expenses)
          .where(eq(expenses.wiseTxnId, p.wiseTxnId))
          .get();
        if (existing) existingTxnIds.add(p.wiseTxnId);
      }
    }

    const toImport = parsed.filter(p => !p.skip && !existingTxnIds.has(p.wiseTxnId));
    const skipped = parsed.filter(p => p.skip);
    const duplicates = parsed.filter(p => existingTxnIds.has(p.wiseTxnId));

    if (!confirmImport) {
      // Preview mode — convert amounts for display
      const previewWithAud = await Promise.all(
        toImport.map(async (exp) => {
          let amountAud: number | null = null;
          try {
            // Convert using the source (GBP) amount if available, otherwise the target currency
            amountAud = await convertToAud(
              exp.sourceAmount ?? exp.amount,
              exp.sourceCurrency ?? exp.currency,
              exp.date
            );
          } catch {
            // If conversion fails, try with the target currency
            try {
              amountAud = await convertToAud(exp.amount, exp.currency, exp.date);
            } catch {
              // Leave null if all conversion fails
            }
          }
          return { ...exp, amountAud };
        })
      );

      return success({
        preview: true,
        toImport: previewWithAud,
        skipped,
        duplicates,
        total: parsed.length,
      });
    }

    // Actual import with AUD conversion
    let imported = 0;
    for (const expense of toImport) {
      let amountAud: number | null = null;
      try {
        amountAud = await convertToAud(
          expense.sourceAmount ?? expense.amount,
          expense.sourceCurrency ?? expense.currency,
          expense.date
        );
      } catch {
        try {
          amountAud = await convertToAud(expense.amount, expense.currency, expense.date);
        } catch {
          // Store without AUD conversion
        }
      }

      await db.insert(expenses).values({
        date: expense.date,
        amount: expense.amount,
        currency: expense.currency,
        amountAud,
        category: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        merchant: expense.merchant,
        wiseTxnId: expense.wiseTxnId,
        source: 'wise_csv',
      });
      imported++;
    }

    return success({
      imported,
      skipped: skipped.length,
      duplicates: duplicates.length,
      total: parsed.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
