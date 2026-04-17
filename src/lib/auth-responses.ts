import type { Metadata } from 'next';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthRequiredError } from '@/lib/auth';

const NO_INDEX_VALUE = 'noindex';

export const authPageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function mergeHeaders(headers?: HeadersInit, retryAfterSeconds?: number) {
  const merged = new Headers(headers);
  merged.set('X-Robots-Tag', NO_INDEX_VALUE);

  if (retryAfterSeconds != null) {
    merged.set('Retry-After', String(retryAfterSeconds));
  }

  return merged;
}

export function authSuccess(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ data }, { status, headers: mergeHeaders(headers) });
}

export function authError(
  message: string,
  status = 400,
  headers?: HeadersInit,
  retryAfterSeconds?: number
) {
  return NextResponse.json(
    { error: message },
    { status, headers: mergeHeaders(headers, retryAfterSeconds) }
  );
}

export class RateLimitError extends Error {
  status = 429;
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests. Please try again later.') {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function handleAuthError(err: unknown) {
  if (err instanceof ZodError) {
    return authError(err.issues.map((issue) => issue.message).join(', '), 400);
  }
  if (err instanceof RateLimitError) {
    return authError(err.message, err.status, undefined, err.retryAfterSeconds);
  }
  if (err instanceof AuthRequiredError) {
    return authError(err.message, err.status);
  }
  console.error(err);
  return authError('Internal server error', 500);
}
