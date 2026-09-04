import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthRequiredError } from '@/lib/auth';

export function success(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return error(err.issues.map(e => e.message).join(', '), 400);
  }
  if (err instanceof AuthRequiredError) {
    return error(err.message, err.status);
  }
  /**
   * `await request.json()` throws a SyntaxError on a malformed body, which 32 route handlers
   * call. That is a client error, not a server fault, so it was previously reported as a 500.
   * Matched on the message as well as the type so a genuine server-side SyntaxError is still
   * surfaced as a 500 rather than silently reclassified.
   */
  if (err instanceof SyntaxError && /JSON|Unexpected (token|end of)/i.test(err.message)) {
    return error('Request body is not valid JSON.', 400);
  }
  console.error(err);
  return error('Internal server error', 500);
}
