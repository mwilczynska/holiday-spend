import { redirect } from 'next/navigation';
import { ForgotPasswordScreen } from '@/components/auth/ForgotPasswordScreen';
import { getConfiguredAuthProviders } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const configured = getConfiguredAuthProviders();

  if (!configured.emailPassword) {
    redirect('/login');
  }

  return <ForgotPasswordScreen />;
}
