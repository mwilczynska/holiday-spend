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
  console.error(err);
  return error('Internal server error', 500);
}
