import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ResetPasswordScreen } from '@/components/auth/ResetPasswordScreen';
import { getConfiguredAuthProviders } from '@/lib/auth';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

export default function ResetPasswordPage() {
  const configured = getConfiguredAuthProviders();

  if (!configured.emailPassword) {
    redirect('/login');
  }

  return (
    <Suspense fallback={null}>
      <ResetPasswordScreen />
    </Suspense>
  );
}
