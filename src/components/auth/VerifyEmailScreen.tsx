'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAdoptPrefilledValue } from '@/lib/use-adopt-prefilled-value';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButtonLabel } from '@/components/ui/loading-state';

/**
 * Verification asks for the password chosen at signup. The link alone used to verify the account,
 * which let someone who registered an allowlisted address first keep a password the mailbox owner
 * never chose.
 */
export function VerifyEmailScreen() {
  const params = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const adoptPassword = useAdoptPrefilledValue(setPassword);
  const [loading, setLoading] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null | undefined>(undefined);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error || 'This verification link is invalid or has expired.');
        setLoading(false);
        return;
      }
      setVerifiedEmail(payload?.data?.email ?? null);
    } catch {
      setMessage('Network error. Please try again.');
      setLoading(false);
    }
  }

  const verified = verifiedEmail !== undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {verified ? 'Email verified' : token ? 'Verify your email' : 'Verification failed'}
          </CardTitle>
          {verified ? (
            <p className="text-sm text-muted-foreground">
              {verifiedEmail ? (
                <>Your account <span className="font-medium text-foreground">{verifiedEmail}</span> is ready.</>
              ) : (
                <>Your account is ready.</>
              )}
            </p>
          ) : token ? (
            <p className="text-sm text-muted-foreground">Enter the password you chose when you signed up.</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {verified ? (
            <Button asChild className="w-full">
              <Link href="/login">Continue to sign in</Link>
            </Button>
          ) : token ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-password">Password</Label>
                <Input
                  id="verify-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  ref={adoptPassword}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {message ? <p className="text-sm text-destructive">{message}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !password}>
                <LoadingButtonLabel idle="Verify email" loading="Verifying..." isLoading={loading} />
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/forgot-password" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Reset your password
                </Link>{' '}
                if you did not choose one.
              </p>
            </form>
          ) : (
            <>
              <p className="text-sm text-destructive text-center">This link is missing its verification token.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
