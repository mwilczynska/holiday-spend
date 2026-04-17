'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButtonLabel } from '@/components/ui/loading-state';

type CheckEmailScreenProps = {
  email: string | null;
};

const RESEND_COOLDOWN_SECONDS = 30;

export function CheckEmailScreen({ email }: CheckEmailScreenProps) {
  const [resendingUntil, setResendingUntil] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const cooldownRemaining = Math.max(0, resendingUntil - Date.now());
  const cooldownActive = cooldownRemaining > 0;

  async function handleResend() {
    if (!email || cooldownActive) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError('Could not resend right now. Please try again shortly.');
      } else {
        setMessage('If that email is awaiting verification, we sent a new link.');
        setResendingUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Check your inbox</CardTitle>
          <p className="text-sm text-muted-foreground">
            {email ? (
              <>We sent a verification link to <span className="font-medium text-foreground">{email}</span>.</>
            ) : (
              <>We sent a verification link to the email you signed up with.</>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Open the email and click the link to finish setting up your account. The link expires in 24 hours.
          </p>

          {email ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={loading || cooldownActive}
            >
              <LoadingButtonLabel
                idle={cooldownActive ? `Resend available in ${Math.ceil(cooldownRemaining / 1000)}s` : 'Resend verification email'}
                loading="Sending..."
                isLoading={loading}
              />
            </Button>
          ) : null}

          {message ? <p className="text-sm text-muted-foreground text-center">{message}</p> : null}
          {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}

          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
