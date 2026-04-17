'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButtonLabel } from '@/components/ui/loading-state';

type LoginScreenProps = {
  hasGoogle: boolean;
  hasEmailPassword: boolean;
  hasDevPin: boolean;
  passwordResetSuccess?: boolean;
};

export function LoginScreen({
  hasGoogle,
  hasEmailPassword,
  hasDevPin,
  passwordResetSuccess = false,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [emailError, setEmailError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [pinLoading, setPinLoading] = useState(false);
  const hasAnyProvider = hasGoogle || hasEmailPassword || hasDevPin;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError('');
    setUnverifiedEmail(null);
    setResendState('idle');

    const result = await signIn('email-password', {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl: '/',
    });

    if (result?.ok) {
      window.location.href = result.url || '/';
      return;
    }

    if (result?.error === 'EMAIL_NOT_VERIFIED') {
      setUnverifiedEmail(email.trim());
    } else if (result?.error === 'RATE_LIMITED') {
      setEmailError('Too many sign-in attempts. Please wait a bit and try again.');
    } else {
      setEmailError('Wrong email or password.');
    }
    setEmailLoading(false);
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    setResendState('loading');
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinLoading(true);
    setPinError('');

    const result = await signIn('dev-pin', {
      pin,
      redirect: false,
      callbackUrl: '/',
    });

    if (result?.ok) {
      window.location.href = result.url || '/';
      return;
    }

    setPinError('Incorrect development PIN');
    setPinLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Wanderledger</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to access your trip data</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordResetSuccess ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-foreground">
              Your password has been reset. Sign in with your new password.
            </div>
          ) : null}

          {hasEmailPassword ? (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}

              {unverifiedEmail ? (
                <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
                  <p className="text-foreground">
                    Verify your email before signing in. We sent a link to{' '}
                    <span className="font-medium">{unverifiedEmail}</span>.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResend}
                    disabled={resendState !== 'idle'}
                  >
                    {resendState === 'sent'
                      ? 'Link resent'
                      : resendState === 'loading'
                      ? 'Sending...'
                      : 'Resend verification email'}
                  </Button>
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={emailLoading || !email || !password}>
                <LoadingButtonLabel idle="Sign in" loading="Signing in..." isLoading={emailLoading} />
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                New here?{' '}
                <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </p>
            </form>
          ) : null}

          {hasEmailPassword && hasGoogle ? (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="bg-background px-2">or</span>
              </div>
            </div>
          ) : null}

          {hasGoogle ? (
            <Button
              variant={hasEmailPassword ? 'outline' : 'default'}
              className="w-full"
              onClick={() => signIn('google', { callbackUrl: '/' })}
            >
              Continue with Google
            </Button>
          ) : null}

          {(hasGoogle || hasEmailPassword) && hasDevPin ? (
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Local development</p>
          ) : null}

          {hasDevPin ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Local Dev Login</p>
                <p className="text-xs text-muted-foreground">
                  Uses the configured `AUTH_DEV_PIN` fallback for local testing.
                </p>
              </div>
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Development PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-2xl tracking-widest"
                />
                {pinError ? <p className="text-sm text-destructive text-center">{pinError}</p> : null}
                <Button type="submit" className="w-full" disabled={pinLoading || !pin}>
                  <LoadingButtonLabel idle="Enter dev mode" loading="Checking..." isLoading={pinLoading} />
                </Button>
              </form>
            </div>
          ) : null}

          {!hasAnyProvider ? (
            <p className="text-sm text-center text-muted-foreground">
              Auth is not configured yet. Set Google OAuth credentials, configure native email delivery,
              or set `AUTH_DEV_PIN` for local development.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
