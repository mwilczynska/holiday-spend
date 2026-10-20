'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { resetAnalyticsIdentity } from '@/lib/analytics/browser';
import { Button } from '@/components/ui/button';

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  if (compact) {
    // Styled like the other mobile navigation items, with a visible label.
    return (
      <button data-analytics="sign-out-button.button"
        type="button"
        className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-1 text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:px-3 sm:text-xs"
        onClick={() => { resetAnalyticsIdentity(); void signOut({ callbackUrl: '/login' }); }}
      >
        <LogOut className="h-5 w-5" />
        <span>Sign out</span>
      </button>
    );
  }

  return (
    <Button data-analytics="sign-out-button.button.2"
      type="button"
      variant="ghost"
      size="sm"
      className="justify-start gap-2"
      onClick={() => { resetAnalyticsIdentity(); void signOut({ callbackUrl: '/login' }); }}
    >
      <LogOut className="h-4 w-4" />
      <span>Sign out</span>
    </Button>
  );
}
