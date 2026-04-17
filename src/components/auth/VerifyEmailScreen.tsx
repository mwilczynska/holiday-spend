'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type VerifyStatus = 'loading' | 'success' | 'error';

export function VerifyEmailScreen() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its verification token.');
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setStatus('error');
          setMessage(payload?.error || 'This verification link is invalid or has expired.');
          return;
        }

        setStatus('success');
        setEmail(payload?.data?.email ?? null);
      } catch {
        if (cancelled) return;
        setStatus('error');
        setMessage('Network error. Please try again.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {status === 'loading'
              ? 'Verifying your email...'
              : status === 'success'
              ? 'Email verified'
              : 'Verification failed'}
          </CardTitle>
          {status === 'success' ? (
            <p className="text-sm text-muted-foreground">
              {email ? (
                <>Your account <span className="font-medium text-foreground">{email}</span> is ready.</>
              ) : (
                <>Your account is ready.</>
              )}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' ? (
            <Button asChild className="w-full">
              <Link href="/login">Continue to sign in</Link>
            </Button>
          ) : null}

          {status === 'error' ? (
            <>
              <p className="text-sm text-destructive text-center">{message}</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
