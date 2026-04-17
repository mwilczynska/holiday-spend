'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButtonLabel } from '@/components/ui/loading-state';

type AccountSettingsProps = {
  email: string;
  name: string;
  hasPassword: boolean;
  hasGoogle: boolean;
};

export function AccountSettings({
  email,
  name: initialName,
  hasPassword,
  hasGoogle,
}: AccountSettingsProps) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameLoading(true);
    setNameStatus(null);
    setNameError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setNameError(payload?.error || 'Could not save display name.');
        return;
      }

      const next = (payload?.data?.name as string | null | undefined) ?? '';
      setSavedName(next);
      setName(next);
      setNameStatus('Display name updated.');
    } catch {
      setNameError('Network error. Please try again.');
    } finally {
      setNameLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setPasswordError(payload?.error || 'Could not change password.');
        setPasswordLoading(false);
        return;
      }

      await signOut({ callbackUrl: '/login?passwordChanged=1' });
    } catch {
      setPasswordError('Network error. Please try again.');
      setPasswordLoading(false);
    }
  }

  const signInMethods: Array<{ label: string; status: string }> = [];
  if (hasGoogle) signInMethods.push({ label: 'Google', status: 'Linked' });
  if (hasPassword) signInMethods.push({ label: 'Email and password', status: 'Set' });

  const nameUnchanged = name.trim() === (savedName ?? '').trim();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, password, and linked sign-in methods.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Email is used to sign in and receive account notifications. Changing your email is
              coming in a later update.
            </p>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-2">
            <Label htmlFor="account-display-name">Display name</Label>
            <Input
              id="account-display-name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
            />
            {nameStatus ? <p className="text-sm text-muted-foreground">{nameStatus}</p> : null}
            {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
            <Button type="submit" disabled={nameLoading || nameUnchanged}>
              <LoadingButtonLabel idle="Save" loading="Saving..." isLoading={nameLoading} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-current-password">Current password</Label>
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-new-password">New password</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  At least 10 characters. Avoid common or guessable passwords.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-confirm-password">Confirm new password</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Changing your password will sign you out on every device. You&rsquo;ll need to sign in
                again.
              </p>
              {passwordError ? (
                <p className="text-sm text-destructive">{passwordError}</p>
              ) : null}
              <Button
                type="submit"
                disabled={
                  passwordLoading || !currentPassword || !newPassword || !confirmPassword
                }
              >
                <LoadingButtonLabel
                  idle="Change password"
                  loading="Saving..."
                  isLoading={passwordLoading}
                />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sign-in methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {signInMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sign-in methods are recorded for this account yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {signInMethods.map((method) => (
                <li
                  key={method.label}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{method.label}</span>
                  <span className="text-xs text-muted-foreground">{method.status}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Add another sign-in method</p>
            <div className="flex flex-wrap gap-2">
              {!hasGoogle ? (
                <Button variant="outline" disabled>
                  Add Google (coming soon)
                </Button>
              ) : null}
              {!hasPassword ? (
                <Button variant="outline" disabled>
                  Add email and password (coming soon)
                </Button>
              ) : null}
              {hasGoogle && hasPassword ? (
                <p className="text-xs text-muted-foreground">
                  Your account already has every supported sign-in method. Unlinking is coming in a
                  later update.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
