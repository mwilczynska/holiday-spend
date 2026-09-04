import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { handleError } from '@/lib/api-helpers';
import { AuthRequiredError } from '@/lib/auth';

async function statusAndBody(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe('handleError', () => {
  it('reports a malformed request body as a client error', async () => {
    // `await request.json()` throws a SyntaxError, and 32 route handlers call it. Reporting
    // that as a 500 blamed the server for a bad request.
    let thrown: unknown;
    try {
      JSON.parse('{not valid json');
    } catch (err) {
      thrown = err;
    }

    const { status, body } = await statusAndBody(handleError(thrown));
    expect(status).toBe(400);
    expect(body.error).toBe('Request body is not valid JSON.');
  });

  it('still reports a genuine server-side error as a 500', async () => {
    const { status, body } = await statusAndBody(handleError(new Error('database is on fire')));
    expect(status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });

  it('does not reclassify an unrelated SyntaxError as a bad request', async () => {
    const { status } = await statusAndBody(handleError(new SyntaxError('invalid regular expression')));
    expect(status).toBe(500);
  });

  it('reports validation failures with their messages', async () => {
    let thrown: ZodError | undefined;
    try {
      z.object({ name: z.string() }).parse({});
    } catch (err) {
      thrown = err as ZodError;
    }

    const { status, body } = await statusAndBody(handleError(thrown));
    expect(status).toBe(400);
    expect(String(body.error).length).toBeGreaterThan(0);
  });

  it('preserves the status carried by an auth error', async () => {
    const { status } = await statusAndBody(handleError(new AuthRequiredError()));
    expect([401, 403]).toContain(status);
  });
});
