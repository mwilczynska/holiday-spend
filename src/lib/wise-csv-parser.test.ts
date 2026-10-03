import { describe, expect, it } from 'vitest';
import { parseWiseCsv, parseWiseCsvFiles } from '@/lib/wise-csv-parser';

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

  it.each([
    ['unrelated headers', 'not,a,wise,export\none,two,three,four'],
    ['empty file', ' \n\n'],
    ['truncated row', `${headers}\ntxn-1,COMPLETED,OUT`],
    ['unterminated quote', `${headers}\n"txn-1,COMPLETED,OUT,2026-08-01`],
  ])('rejects %s instead of creating a zero-value expense', (_name, csv) => {
    expect(() => parseWiseCsv(csv)).toThrow();
  });

  it.each([
    ['missing transaction ID', 0, ''],
    ['invalid calendar date', 3, '2026-02-30'],
    ['missing amount', 4, ''],
    ['partially numeric amount', 4, '10oops'],
    ['nonfinite amount', 4, 'Infinity'],
    ['invalid source currency', 5, '?'],
    ['invalid target amount', 6, '14oops'],
    ['invalid target currency', 7, '?'],
  ])('rejects a row with %s', (_name, index, value) => {
    const fields = transaction('txn-1', 'First Cafe').split('\n')[1].split(',');
    fields[index as number] = value as string;
    expect(() => parseWiseCsv(`${headers}\n${fields.join(',')}`)).toThrow();
  });

  it('keeps supported compact and balance-statement exports, zeros and header-only files', () => {
    expect(parseWiseCsv('ID,Date,Amount,Currency\ncompact-1,01-08-2026,0,AUD')[0]).toMatchObject({
      wiseTxnId: 'compact-1', date: '2026-08-01', amount: 0, currency: 'AUD',
    });
    const balance = 'TransferWise ID,Date Time,Transaction Type,Amount,Currency,Merchant,Transaction Details Type\n'
      + 'balance-1,2026-08-01 10:00:00,DEBIT,-25,AUD,First Cafe,CARD\n'
      + 'balance-2,2026-08-02 10:00:00,CREDIT,25,AUD,Refund,CARD';
    expect(parseWiseCsv(balance).map(row => ({ id: row.wiseTxnId, amount: row.amount, skip: row.skip }))).toEqual([
      { id: 'balance-1', amount: 25, skip: false }, { id: 'balance-2', amount: 25, skip: true },
    ]);
    expect(parseWiseCsv(headers)).toEqual([]);
  });

  it('rejects a mixed upload if any file is unsupported', () => {
    expect(() => parseWiseCsvFiles([transaction('valid-1', 'First Cafe'), 'not,a,wise,export\none,two,three,four'])).toThrow();
  });
});
