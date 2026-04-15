'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? 'icon' : 'sm'}
      className={compact ? 'h-9 w-9' : 'justify-start gap-2'}
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      <LogOut className="h-4 w-4" />
      {compact ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
    </Button>
  );
}
