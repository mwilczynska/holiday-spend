'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButtonLabel } from '@/components/ui/loading-state';

type LoginScreenProps = {
  hasGoogle: boolean;
  hasCredentials: boolean;
};

export function LoginScreen({ hasGoogle, hasCredentials }: LoginScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasAnyProvider = hasGoogle || hasCredentials;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      pin,
      redirect: false,
      callbackUrl: '/',
    });

    if (result?.ok) {
      window.location.href = result.url || '/';
      return;
    }

    setError('Incorrect development PIN');
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Wanderledger</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to access your trip data</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasGoogle ? (
            <Button className="w-full" onClick={() => signIn('google', { callbackUrl: '/' })}>
              Continue with Google
            </Button>
          ) : null}

          {hasGoogle && hasCredentials ? (
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Local development</p>
          ) : null}

          {hasCredentials ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Local Dev Login</p>
                <p className="text-xs text-muted-foreground">
                  Uses the configured `AUTH_DEV_PIN` fallback for local testing.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Development PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-2xl tracking-widest"
                  autoFocus={!hasGoogle}
                />
                {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={loading || !pin}>
                  <LoadingButtonLabel idle="Enter dev mode" loading="Checking..." isLoading={loading} />
                </Button>
              </form>
            </div>
          ) : null}

          {!hasAnyProvider ? (
            <p className="text-sm text-center text-muted-foreground">
              Auth is not configured yet. Set Google OAuth credentials, or set `AUTH_DEV_PIN` for local development.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
