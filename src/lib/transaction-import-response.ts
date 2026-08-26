export interface ImportApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Read an import API response without assuming that a failed server request
 * still returned JSON. Next's development error page is HTML, and surfacing
 * its parser exception directly makes the import screen unusable.
 */
export async function readImportApiResponse<T>(response: Response): Promise<ImportApiResponse<T>> {
  const body = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(
      response.ok
        ? 'Import failed: the server returned an invalid response.'
        : `Import failed (${response.status}).`
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Import failed: the server returned an invalid response.');
  }

  const record = payload as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof record.error === 'string' && record.error.trim()
        ? record.error
        : `Import failed (${response.status}).`
    );
  }

  return {
    data: record.data as T | undefined,
    error: typeof record.error === 'string' ? record.error : undefined,
  };
}

export function getImportErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Import failed. Please try again.';
}
