import { describe, expect, it } from 'vitest';
import { getImportErrorMessage, readImportApiResponse } from '@/lib/transaction-import-response';

describe('transaction import response handling', () => {
  it('turns an HTML server error into a user-facing import error', async () => {
    const response = new Response('<!doctype html><title>Internal Server Error</title>', { status: 500 });

    await expect(readImportApiResponse(response)).rejects.toThrow('Import failed (500).');
    await expect(readImportApiResponse(new Response('not json'))).rejects.toThrow(
      'Import failed: the server returned an invalid response.'
    );
  });

  it('preserves API error messages and successful data', async () => {
    await expect(
      readImportApiResponse(new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 }))
    ).rejects.toThrow('No file provided');

    await expect(
      readImportApiResponse<{ imported: number }>(
        new Response(JSON.stringify({ data: { imported: 2 } }), { status: 200 })
      )
    ).resolves.toEqual({ data: { imported: 2 } });
  });

  it('falls back to a stable message for unknown errors', () => {
    expect(getImportErrorMessage({})).toBe('Import failed. Please try again.');
  });
});
