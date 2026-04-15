'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButtonLabel } from '@/components/ui/loading-state';
import { getProviders, signIn } from 'next-auth/react';

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderMap>(null);

  useEffect(() => {
    void getProviders().then((result) => setProviders(result));
  }, []);

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
    } else {
      setError('Incorrect development PIN');
      setLoading(false);
    }
  }

  const hasGoogle = Boolean(providers?.google);
  const hasCredentials = Boolean(providers?.credentials);
  const hasAnyProvider = hasGoogle || hasCredentials;

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
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Development PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !pin}>
                <LoadingButtonLabel idle="Enter dev mode" loading="Checking..." isLoading={loading} />
              </Button>
            </form>
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
