import { describe, expect, it } from 'vitest';
import { parseWiseCsvFiles } from '@/lib/wise-csv-parser';

const headers = [
  'ID',
  'Status',
  'Direction',
  'Created on',
  'Source amount (after fees)',
  'Source currency',
  'Target amount (after fees)',
  'Target currency',
  'Target name',
  'Reference',
  'Category',
].join(',');

function transaction(id: string, merchant: string): string {
  return [headers, `${id},COMPLETED,OUT,2026-08-01,10,USD,14,AUD,${merchant},trip,Food & Drink`].join('\n');
}

describe('Wise CSV parser', () => {
  it('parses multiple exports independently before combining their rows', () => {
    const parsed = parseWiseCsvFiles([
      transaction('txn-1', 'First Cafe'),
      transaction('txn-2', 'Second Cafe'),
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed.map((expense) => expense.wiseTxnId)).toEqual(['txn-1', 'txn-2']);
    expect(parsed.map((expense) => expense.merchant)).toEqual(['First Cafe', 'Second Cafe']);
  });

  it('keeps the existing single-file parser behavior', () => {
    const [expense] = parseWiseCsvFiles([transaction('txn-1', 'First Cafe')]);

    expect(expense).toMatchObject({
      wiseTxnId: 'txn-1',
      amount: 14,
      currency: 'AUD',
      merchant: 'First Cafe',
      skip: false,
    });
  });
});
