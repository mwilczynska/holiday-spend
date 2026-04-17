import { redirect } from 'next/navigation';
import { ForgotPasswordScreen } from '@/components/auth/ForgotPasswordScreen';
import { getConfiguredAuthProviders } from '@/lib/auth';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

export default function ForgotPasswordPage() {
  const configured = getConfiguredAuthProviders();

  if (!configured.emailPassword) {
    redirect('/login');
  }

  return <ForgotPasswordScreen />;
}
